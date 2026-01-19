import { FastifyPluginAsync } from "fastify";
import { Pool } from "pg";
declare module "fastify" {
    interface FastifyInstance {
        db: Pool;
    }
}
export declare const databasePlugin: FastifyPluginAsync;
//# sourceMappingURL=index.d.ts.map