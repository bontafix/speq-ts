import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import { Pool } from 'pg';
import { pgPool, checkDatabaseHealth } from '../../../db/pg';

declare module 'fastify' {
  interface FastifyInstance {
    db: Pool;
  }
}

/**
 * Плагин для регистрации database pool в Fastify
 * Использует общий pgPool из src/db/pg.ts
 */
export const databasePlugin = fp(async function databasePlugin(fastify: FastifyInstance) {
  // Регистрируем общий пул
  fastify.decorate('db', pgPool);
  
  // Проверяем подключение при старте
  try {
    const health = await checkDatabaseHealth();
    
    if (health.ok) {
      fastify.log.info('✅ Database connection established and health check passed');
    } else {
      fastify.log.warn('⚠️ Database health check found issues:');
      health.issues.forEach(issue => {
        if (issue.level === 'error') fastify.log.error(`- ${issue.message}`);
        else fastify.log.warn(`- ${issue.message}`);
      });
      
      // Если есть критические ошибки, можно остановить старт сервера
      // if (health.issues.some(i => i.level === 'error')) {
      //   throw new Error('Database health check failed');
      // }
    }
  } catch (error) {
    fastify.log.error('❌ Failed to check database health:', error);
    // Не падаем, чтобы сервер мог запуститься и показать ошибку 500
  }
  
  // Graceful shutdown
  fastify.addHook('onClose', async () => {
    fastify.log.info('Closing database connections...');
    await pgPool.end();
  });
}, {
  name: 'database-plugin',
});
