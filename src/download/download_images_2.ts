import "../config/env-loader";
import { pgPool } from "../db/pg";
import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import sharp from 'sharp';
import { Command } from 'commander';

const STORAGE_MODE = process.env.STORAGE_MODE || 'subfolders';
const BASE_DIR = process.env.BASE_DIR || './images';
const MAX_RETRIES = parseInt(process.env.MAX_RETRIES || '3', 10);


const program = new Command();
program
    .option('-l, --limit <number>', 'Лимит записей оборудования для обработки', parseInt)
    .option('-m, --max-links <number>', 'Максимальное количество ссылок из массива для обработки', parseInt)
    .parse(process.argv);

const options = program.opts();
const cliLimit = options.limit || null;
const maxLinks = options.maxLinks || null;

async function downloadAndProcessImage(url: string, filePath: string): Promise<void> {
    const response = await axios({
        url,
        method: 'GET',
        responseType: 'arraybuffer',
        timeout: 15000,
    });

    await fs.ensureDir(path.dirname(filePath));

    const isWebp = url.toLowerCase().endsWith('.webp');
    if (isWebp) {
        await sharp(response.data).png().toFile(filePath);
    } else {
        await fs.writeFile(filePath, response.data);
    }
}

async function runDownloader() {
    console.log("Starting image download process...");

    try {
        const maxLinksToCheck = maxLinks || 999; // или другое значение по умолчанию

        const { rows: equipmentRecords } = await pgPool.query(`
            SELECT e.id, e.photo_links, e.url
            FROM equipment e
            WHERE e.photo_links IS NOT NULL 
              AND jsonb_array_length(e.photo_links) > 0
              AND EXISTS (
                  SELECT 1 
                  FROM jsonb_array_elements_text(e.photo_links) WITH ORDINALITY AS arr(link, idx)
                  LEFT JOIN images_download idl 
                    ON idl.id_equipment = e.id 
                    AND idl.index_images = (arr.idx - 1)
                  WHERE arr.idx <= $2 -- Берем только первые maxLinksToCheck ссылок
                    AND (idl.id IS NULL 
                         OR (idl.error IS NOT NULL AND idl.error_count < $1))
              )
            ORDER BY e.id ASC
            ${cliLimit ? `LIMIT ${cliLimit}` : ''}
        `, [MAX_RETRIES, maxLinksToCheck]);

        console.log(`Found ${equipmentRecords.length} equipment records to process.`);

        for (const record of equipmentRecords) {
            const equipmentId = record.id;
            const links = record.photo_links as string[];
            const equipmentPageUrl = record.url;

            let baseOrigin = '';
            try {
                if (equipmentPageUrl) {
                    baseOrigin = new URL(equipmentPageUrl).origin;
                }
            } catch (e) {}


            const linksToDownload = maxLinks ? links.slice(0, maxLinks) : links;
            for (let index = 0; index < maxLinks; index++) {
                console.log(`[ID: ${equipmentId}] [IDX: ${index}]`);
                const rawUrl = links[index];
                if (!rawUrl) continue;

                // Проверяем статус конкретной картинки
                const { rows: logRows } = await pgPool.query(
                    `SELECT error, error_count FROM images_download 
                     WHERE id_equipment = $1 AND index_images = $2`,
                    [equipmentId, index]
                );
                const logEntry = logRows[0];

                // Пропускаем, если уже скачано успешно или достигнут лимит ошибок
                if (logEntry && logEntry.error === null) continue;
                if (logEntry && logEntry.error_count >= MAX_RETRIES) continue;

                try {
                    let finalUrl: string;
                    try {
                        if (rawUrl.startsWith('/')) {
                            if (!baseOrigin) throw new Error(`INVALID_URL: Relative link without base origin`);
                            finalUrl = new URL(rawUrl, baseOrigin).href;
                        } else {
                            finalUrl = new URL(rawUrl).href;
                        }
                    } catch (e: any) {
                        throw new Error(`INVALID_URL: ${e.message}`);
                    }

                    let ext = path.extname(new URL(finalUrl).pathname).toLowerCase() || '.jpg';
                    if (ext === '.webp') ext = '.png';
                    
                    const fullPath = STORAGE_MODE === 'single_folder' 
                        ? path.join(BASE_DIR, `${equipmentId}-${index}${ext}`)
                        : path.join(BASE_DIR, equipmentId.toString(), `${index}${ext}`);

                    console.log(`[ID: ${equipmentId}] Downloading [${index}]: ${finalUrl}`);
                    await downloadAndProcessImage(finalUrl, fullPath);

                    await pgPool.query(`
                        INSERT INTO images_download (id_equipment, index_images, error, error_count, created_at)
                        VALUES ($1, $2, NULL, 0, NOW())
                        ON CONFLICT (id_equipment, index_images) 
                        DO UPDATE SET error = NULL, error_count = 0, created_at = NOW()
                    `, [equipmentId, index]);

                } catch (error: any) {
                    const errorMsg = error.message || 'Unknown error';
                    const isInvalidUrl = errorMsg.includes('INVALID_URL');
                    const newErrorCount = isInvalidUrl ? 10 : (logEntry?.error_count || 0) + 1;

                    console.error(`[ID: ${equipmentId}] [IDX: ${index}] Error: ${errorMsg}`);

                    await pgPool.query(`
                        INSERT INTO images_download (id_equipment, index_images, error, error_count, created_at)
                        VALUES ($1, $2, $3, $4, NOW())
                        ON CONFLICT (id_equipment, index_images) 
                        DO UPDATE SET error = $3, error_count = $4, created_at = NOW()
                    `, [equipmentId, index, errorMsg, newErrorCount]);
                }
            }
        }
    } catch (err) {
        console.error("Critical error:", err);
    } finally {
        console.log("Process finished.");
    }
}

runDownloader();