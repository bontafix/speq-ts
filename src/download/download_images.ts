import "dotenv/config";
import { pgPool } from "../db/pg";
import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import sharp from 'sharp';
import { pipeline } from 'stream/promises';
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

let shuttingDown = false;

// Хелпер для проверки расширения (игнорируя query параметры)
const isWebpUrl = (url: string) => {
    try {
        const pathname = new URL(url).pathname.toLowerCase();
        return pathname.endsWith('.webp');
    } catch {
        return url.toLowerCase().includes('.webp');
    }
};

async function downloadAndProcessImage(url: string, filePath: string): Promise<void> {
    await fs.ensureDir(path.dirname(filePath));

    const response = await axios({
        url,
        method: 'GET',
        responseType: 'stream',
        timeout: 15000,
        maxContentLength: 15 * 1024 * 1024, // Увеличил до 15MB на всякий случай
        validateStatus: (status) => status === 200, // Строго 200 OK
    });

    if (isWebpUrl(url)) {
        // Если WebP -> Конвертируем в PNG на лету через pipeline
        await pipeline(
            response.data,
            sharp().png(),
            fs.createWriteStream(filePath)
        );
    } else {
        // Иначе просто сохраняем поток в файл
        await pipeline(
            response.data,
            fs.createWriteStream(filePath)
        );
    }
}

function printStatistics(totalInDb: number, processedThisSession: number, limit: number | null) {
    console.log('\n' + '='.repeat(60));
    console.log('СТАТИСТИКА ОБРАБОТКИ:');
    console.log(`  Всего в очереди БД:    ${totalInDb}`);
    console.log(`  Обработано сейчас:     ${processedThisSession}${limit ? ` из лимита ${limit}` : ''}`);
    console.log('='.repeat(60) + '\n');
}

async function runDownloader() {
    // РЕГИСТРАЦИЯ СИГНАЛОВ ЗАВЕРШЕНИЯ
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    console.log("Starting image download process...");

    try {
        // Считаем сколько всего осталось работы в базе
        const { rows: countRes } = await pgPool.query(`
            SELECT COUNT(*) as total FROM equipment e
            WHERE e.photo_links IS NOT NULL AND jsonb_array_length(e.photo_links) > 0
            AND EXISTS (
                SELECT 1 FROM jsonb_array_elements_text(e.photo_links) WITH ORDINALITY AS arr(link, idx)
                LEFT JOIN images_download idl ON idl.id_equipment = e.id AND idl.index_images = (arr.idx - 1)
                WHERE idl.id IS NULL OR (idl.error IS NOT NULL AND idl.error_count < $1)
            )
        `, [MAX_RETRIES]);
        
        const totalPendingInDb = parseInt(countRes[0].total, 10);

        // Получаем список записей согласно лимиту
        const { rows: equipmentRecords } = await pgPool.query(`
            SELECT e.id, e.photo_links, e.url FROM equipment e
            WHERE e.photo_links IS NOT NULL AND jsonb_array_length(e.photo_links) > 0
            AND EXISTS (
                SELECT 1 FROM jsonb_array_elements_text(e.photo_links) WITH ORDINALITY AS arr(link, idx)
                LEFT JOIN images_download idl ON idl.id_equipment = e.id AND idl.index_images = (arr.idx - 1)
                WHERE idl.id IS NULL OR (idl.error IS NOT NULL AND idl.error_count < $1)
            )
            ORDER BY e.id ASC
            ${cliLimit ? `LIMIT ${cliLimit}` : ''}
        `, [MAX_RETRIES]);

        console.log(`Found ${equipmentRecords.length} records to process in this session.`);
        let processedCount = 0;

        for (const record of equipmentRecords) {
            if (shuttingDown) break;

            const equipmentId = record.id;
            const links = record.photo_links as string[];
            let baseOrigin = '';
            
            try {
                if (record.url) baseOrigin = new URL(record.url).origin;
            } catch { /* ignore */ }

            // Ограничиваем количество ссылок внутри одного товара, если задан --max-links
            const linksToDownload = maxLinks ? links.slice(0, maxLinks) : links;

            for (let index = 0; index < linksToDownload.length; index++) {
                if (shuttingDown) break;

                const rawUrl = linksToDownload[index];
                if (!rawUrl) continue;

                // Проверка текущего статуса в базе (чтобы не перекачивать в рамках одного запуска)
                const { rows: logRows } = await pgPool.query(
                    `SELECT error, error_count FROM images_download WHERE id_equipment = $1 AND index_images = $2`,
                    [equipmentId, index]
                );
                const logEntry = logRows[0];

                if (logEntry && logEntry.error === null) continue;
                if (logEntry && logEntry.error_count >= MAX_RETRIES) continue;

                try {
                    let finalUrl: string;
                    try {
                        if (rawUrl.startsWith('/')) {
                            if (!baseOrigin) throw new Error("INVALID_URL: No base origin for relative path");
                            finalUrl = new URL(rawUrl, baseOrigin).href;
                        } else {
                            finalUrl = new URL(rawUrl).href;
                        }
                    } catch (e: any) {
                        throw new Error(`INVALID_URL: ${e.message}`);
                    }

                    // Формируем расширение
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
                    const isInvalid = errorMsg.includes('INVALID_URL');
                    const newCount = isInvalid ? 10 : (logEntry?.error_count || 0) + 1;

                    console.error(`[ID: ${equipmentId}] [IDX: ${index}] Error: ${errorMsg}`);

                    await pgPool.query(`
                        INSERT INTO images_download (id_equipment, index_images, error, error_count, created_at)
                        VALUES ($1, $2, $3, $4, NOW())
                        ON CONFLICT (id_equipment, index_images) 
                        DO UPDATE SET error = $3, error_count = $4, created_at = NOW()
                    `, [equipmentId, index, errorMsg, newCount]);
                }
            }
            processedCount++;
        }

        printStatistics(totalPendingInDb, processedCount, cliLimit);

    } catch (err) {
        console.error("Critical error:", err);
    } finally {
        if (!shuttingDown) {
            await pgPool.end();
            console.log("Database connection closed.");
        }
    }
}

async function shutdown(signal: string) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\nReceived ${signal}. Graceful shutdown...`);
    
    try {
        await pgPool.end();
        console.log('Database pool closed.');
    } catch (e) {
        // Игнорируем если уже закрыто
    }
    process.exit(0);
}

runDownloader();