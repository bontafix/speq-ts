#!/usr/bin/env node

/**
 * Консольный модуль для ресайза изображений
 * Проходит по папке images/ и всем подпапкам, ресайзит изображения до указанной ширины
 * 
 * Использование:
 *   ts-node src/scripts/resize-images.ts --width 50
 *   или
 *   npm run resize:images -- --width 50
 */

import "dotenv/config";
import { readdir, stat, readFile, writeFile } from "fs/promises";
import { join, extname, basename, dirname } from "path";
import { cwd } from "process";
import sharp from "sharp";

const IMAGES_DIR = join(cwd(), "images");

interface ResizeStats {
  processed: number;
  created: number;
  skipped: number;
  errors: number;
}

/**
 * Проверяет, является ли файл изображением
 */
function isImageFile(filename: string): boolean {
  const ext = extname(filename).toLowerCase();
  return ext === ".png" || ext === ".jpg" || ext === ".jpeg";
}

/**
 * Получает базовое имя файла без расширения
 */
function getBaseName(filename: string): string {
  const ext = extname(filename);
  return basename(filename, ext);
}

/**
 * Ресайзит изображение
 */
async function resizeImage(
  inputPath: string,
  outputPath: string,
  width: number
): Promise<void> {
  const image = sharp(inputPath);
  const metadata = await image.metadata();

  // Пропускаем, если изображение уже меньше или равно указанной ширине
  if (metadata.width && metadata.width <= width) {
    return;
  }

  const ext = extname(outputPath).toLowerCase();
  const resized = image.resize(width, null, { withoutEnlargement: true });

  // Сохраняем в том же формате, что и оригинал
  if (ext === ".png") {
    await resized.png().toFile(outputPath);
  } else {
    // Для jpg/jpeg используем jpeg
    await resized.jpeg({ quality: 85 }).toFile(outputPath);
  }
}

/**
 * Обрабатывает одну подпапку
 */
async function processDirectory(
  dirPath: string,
  width: number,
  stats: ResizeStats
): Promise<void> {
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);

      if (entry.isDirectory()) {
        // Рекурсивно обрабатываем подпапки
        await processDirectory(fullPath, width, stats);
      } else if (entry.isFile() && isImageFile(entry.name)) {
        // Обрабатываем только файлы с именем "0"
        const baseName = getBaseName(entry.name);
        if (baseName !== "0") {
          continue;
        }

        stats.processed++;

        const ext = extname(entry.name);
        const outputFileName = `0-${width}${ext}`;
        const outputPath = join(dirPath, outputFileName);

        try {
          // Проверяем, существует ли уже ресайзнутый файл
          try {
            await stat(outputPath);
            // Файл уже существует - пропускаем
            stats.skipped++;
            console.log(`⏭️  Пропущено (уже существует): ${fullPath} -> ${outputFileName}`);
            continue;
          } catch {
            // Файл не существует - создаём
          }

          // Ресайзим изображение
          await resizeImage(fullPath, outputPath, width);
          stats.created++;
          console.log(`✅ Создано: ${fullPath} -> ${outputFileName}`);
        } catch (error: any) {
          stats.errors++;
          console.error(`❌ Ошибка при обработке ${fullPath}:`, error.message);
        }
      }
    }
  } catch (error: any) {
    console.error(`❌ Ошибка при чтении директории ${dirPath}:`, error.message);
  }
}

/**
 * Главная функция
 */
async function main() {
  // Парсим аргументы командной строки
  const args = process.argv.slice(2);
  let width: number | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--width" || args[i] === "-w") {
      const widthValue = args[i + 1];
      if (widthValue) {
        width = parseInt(widthValue, 10);
        if (isNaN(width) || width <= 0) {
          console.error("❌ Ошибка: ширина должна быть положительным числом");
          process.exit(1);
        }
      } else {
        console.error("❌ Ошибка: не указана ширина после --width");
        process.exit(1);
      }
      break;
    }
  }

  if (!width) {
    console.log("Использование:");
    console.log("  ts-node src/scripts/resize-images.ts --width <ширина>");
    console.log("  или");
    console.log("  npm run resize:images -- --width <ширина>");
    console.log("");
    console.log("Пример:");
    console.log("  ts-node src/scripts/resize-images.ts --width 50");
    process.exit(1);
  }

  console.log("=".repeat(80));
  console.log("РЕСАЙЗ ИЗОБРАЖЕНИЙ");
  console.log("=".repeat(80));
  console.log(`Директория: ${IMAGES_DIR}`);
  console.log(`Ширина: ${width}px`);
  console.log("=".repeat(80));
  console.log("");

  // Проверяем существование директории
  try {
    await stat(IMAGES_DIR);
  } catch {
    console.error(`❌ Ошибка: директория ${IMAGES_DIR} не найдена`);
    process.exit(1);
  }

  const stats: ResizeStats = {
    processed: 0,
    created: 0,
    skipped: 0,
    errors: 0,
  };

  console.log("Начало обработки...\n");

  // Обрабатываем директорию images
  await processDirectory(IMAGES_DIR, width, stats);

  console.log("");
  console.log("=".repeat(80));
  console.log("РЕЗУЛЬТАТЫ");
  console.log("=".repeat(80));
  console.log(`Обработано файлов: ${stats.processed}`);
  console.log(`Создано новых: ${stats.created}`);
  console.log(`Пропущено (уже существуют): ${stats.skipped}`);
  console.log(`Ошибок: ${stats.errors}`);
  console.log("=".repeat(80));
}

void main();
