#!/usr/bin/env node
import "dotenv/config";
import { LLMProviderFactory } from "../llm";
import { ConfigService } from "../config/config";
import chalk from "chalk";

/**
 * Скрипт для проверки качества эмбеддингов.
 * Генерирует векторы для нескольких фраз и показывает cosine similarity между ними.
 * Помогает понять, насколько модель "понимает" смысл.
 */

async function main() {
    console.log(chalk.bold.blue("🧪 Проверка качества эмбеддингов"));
    console.log("---------------------------------------");

    const config = new ConfigService();
    const model = config.llm.embeddingModel;
    const factory = new LLMProviderFactory();

    console.log(`Модель: ${chalk.cyan(model)}`);
    
    // Тестовые фразы (пары: похожие и разные)
    const phrases = [
        "трактор",
        "экскаватор", // Похоже на трактор
        "банан",      // Вообще не похоже
        "фронтальный погрузчик", // Техника
        "snow plow"   // "снегоуборочный отвал" на английском
    ];

    console.log(`\nГенерация векторов для ${phrases.length} фраз...`);
    
    try {
        const { embeddings } = await factory.embeddings({
            model,
            input: phrases
        });

        // Функция косинусного сходства
        const cosineSim = (a: number[], b: number[]) => {
            if (!a || !b) return 0;
            let dot = 0;
            let magA = 0;
            let magB = 0;
            const len = Math.min(a.length, b.length);
            
            for (let i = 0; i < len; i++) {
                // @ts-ignore - мы проверили существование массивов
                const valA = a[i];
                // @ts-ignore
                const valB = b[i];
                
                if (valA !== undefined && valB !== undefined) {
                    dot += valA * valB;
                    magA += valA * valA;
                    magB += valB * valB;
                }
            }
            if (magA === 0 || magB === 0) return 0;
            return dot / (Math.sqrt(magA) * Math.sqrt(magB));
        };

        console.log("\n📊 Матрица сходства (1.0 = идентично, 0.0 = нет связи):\n");
        
        // Заголовок
        console.log(" ".repeat(25) + phrases.map((_, i) => `[${i+1}]`.padStart(8)).join(""));

        phrases.forEach((p1, i) => {
            let row = `[${i+1}] ${p1.padEnd(20)} `;
            phrases.forEach((p2, j) => {
                const vecA = embeddings[i];
                const vecB = embeddings[j];
                
                if (!vecA || !vecB) {
                    row += chalk.gray("   -    ");
                    return;
                }

                const sim = cosineSim(vecA, vecB);
                let color = chalk.gray;
                if (sim > 0.8) color = chalk.green;
                else if (sim > 0.6) color = chalk.yellow;
                else if (sim < 0.3) color = chalk.red;
                
                // Самого себя не подсвечиваем ярко
                if (i === j) color = chalk.gray;

                row += color(sim.toFixed(4).padStart(8));
            });
            console.log(row);
        });

        console.log("\n🔍 Выводы:");
        console.log("- 'трактор' и 'экскаватор' должны иметь высокую связь (> 0.6)");
        console.log("- 'трактор' и 'банан' должны иметь низкую связь (< 0.3)");
        console.log("- Английский текст должен иметь адекватную связь с русским аналогом, если модель мультиязычная");

    } catch (e: any) {
        console.error(chalk.red("\n❌ Ошибка:"), e.message);
        if (e.message.includes("does not support embeddings")) {
             console.log(chalk.yellow("\n💡 Groq не поддерживает эмбеддинги. Используйте Ollama или OpenAI в .env:"));
             console.log("LLM_EMBEDDINGS_PROVIDER=ollama");
             console.log("EMBED_MODEL=nomic-embed-text");
        }
    }
}

main();

