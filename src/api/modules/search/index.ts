import { FastifyInstance } from "fastify";
import { CatalogService } from "../../../catalog";
import { SearchEngine } from "../../../search";
import { EquipmentRepository } from "../../../repository/equipment.repository";
import { ParameterDictionaryService } from "../../../normalization";
import { SearchQuery } from "../../../catalog";
import { LLMProviderFactory } from "../../../llm";

export async function searchPlugin(fastify: FastifyInstance) {
  const dictionaryService = new ParameterDictionaryService();
  // Передаем пул соединений из fastify.db
  const repository = new EquipmentRepository(fastify.db, dictionaryService);
  const llmFactory = new LLMProviderFactory();
  
  // Load dictionary asynchronously
  try {
    await dictionaryService.loadDictionary();
  } catch (error) {
    fastify.log.warn({ err: error }, "Failed to load parameter dictionary. Normalization disabled.");
  }

  const searchEngine = new SearchEngine(repository, dictionaryService, llmFactory);
  const catalogService = new CatalogService(searchEngine);

  fastify.get("/search", {
    schema: {
      description: "Search equipment",
      tags: ["Search"],
      querystring: {
        type: "object",
        properties: {
          text: { type: "string" },
          category: { type: "string" },
          brand: { type: "string" },
          region: { type: "string" },
          limit: { type: "integer", default: 10 },
          offset: { type: "integer", default: 0 }
        }
      },
      response: {
        200: {
          type: "object",
          properties: {
            total: { type: "integer" },
            items: { 
              type: "array",
              items: {
                type: "object",
                additionalProperties: true
              }
            },
            message: { type: "string" },
            suggestions: {
              type: "object",
              additionalProperties: true
            }
          }
        },
        400: {
          type: "object",
          properties: {
            error: { type: "string" }
          }
        },
        500: {
          type: "object",
          properties: {
            error: { type: "string" },
            details: { type: "string" }
          }
        }
      }
    }
  }, async (request, reply) => {
    const query = request.query as SearchQuery;

    if (!query.text && !query.category && !query.brand) {
      return reply.status(400).send({
        error: "Specify at least one parameter: text, category, brand (optional: region, limit)."
      });
    }

    try {
      const result = await catalogService.searchEquipment(query);
      return result;
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({
        error: "Error executing search",
        details: String(err)
      });
    }
  });
}
