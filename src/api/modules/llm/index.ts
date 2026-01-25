import { FastifyInstance } from "fastify";
import { LLMProviderFactory, ProviderType } from "../../../llm";

export async function llmPlugin(fastify: FastifyInstance) {
  const llmFactory = new LLMProviderFactory();

  // GET /llm/providers
  fastify.get("/llm/providers", {
    schema: {
      description: "Get LLM providers info",
      tags: ["LLM"],
      response: {
        200: {
          type: "object",
          properties: {
            available: { 
              type: "object",
              additionalProperties: { type: "boolean" }
            },
            health: { 
              type: "object",
              additionalProperties: { type: "boolean" }
            },
            config: {
              type: "object",
              properties: {
                chatProvider: { type: "string" },
                embeddingsProvider: { type: "string" },
                fallbackProviders: { 
                  type: "array",
                  items: { type: "string" }
                }
              }
            }
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
    try {
      const health = await llmFactory.checkHealth();
      const config = llmFactory.getConfig();
      const available = llmFactory.getAvailableProviders();

      return {
        available,
        health,
        config: {
          chatProvider: config.chatProvider,
          embeddingsProvider: config.embeddingsProvider,
          fallbackProviders: config.fallbackProviders,
        },
      };
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({
        error: "Error getting providers info",
        details: String(err),
      });
    }
  });

  // GET /llm/providers/models
  fastify.get("/llm/providers/models", {
    schema: {
      description: "Get LLM provider models",
      tags: ["LLM"],
      querystring: {
        type: "object",
        required: ["provider"],
        properties: {
          provider: { type: "string", enum: ["ollama", "groq", "openai"] }
        }
      },
      response: {
        200: {
          type: "object",
          properties: {
            provider: { type: "string" },
            models: { 
              type: "array",
              items: { type: "string" }
            },
            note: { type: "string" }
          }
        },
        400: {
          type: "object",
          properties: {
            error: { type: "string" }
          }
        },
        404: {
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
    const { provider: providerType } = request.query as { provider: ProviderType };

    try {
      const provider = llmFactory.getProvider(providerType);
      if (!provider) {
        return reply.status(404).send({
          error: `Provider ${providerType} not initialized`,
        });
      }

      // For Groq use listModels if available
      if (providerType === "groq" && "listModels" in provider && typeof (provider as any).listModels === "function") {
        const models = await (provider as any).listModels();
        return {
          provider: providerType,
          models,
        };
      }

      // Recommendations for others
      const recommendations: Record<string, string[]> = {
        ollama: ["qwen2.5:7b-instruct-q4_K_M", "llama3.2:3b", "llama3.3:70b"],
        groq: ["llama-3.3-70b-versatile", "llama-3.1-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x22b-instruct", "gemma2-9b-it"],
        openai: ["gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo"],
      };

      return {
        provider: providerType,
        models: recommendations[providerType] || [],
        note: "These are recommended models. Use provider API directly for full list.",
      };
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({
        error: "Error getting models list",
        details: String(err),
      });
    }
  });

  // POST /llm/providers/set
  fastify.post("/llm/providers/set", {
    schema: {
      description: "Set LLM provider",
      tags: ["LLM"],
      body: {
        type: "object",
        properties: {
          chatProvider: { type: "string" },
          embeddingsProvider: { type: "string" }
        }
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            config: {
              type: "object",
              properties: {
                chatProvider: { type: "string" },
                embeddingsProvider: { type: "string" }
              }
            }
          }
        },
        400: {
          type: "object",
          properties: {
            error: { type: "string" },
            details: { type: "string" }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { chatProvider, embeddingsProvider } = request.body as { chatProvider?: string, embeddingsProvider?: string };

    try {
      if (chatProvider) {
        // Chat provider is fixed to groq in this project
        if (String(chatProvider).trim() !== "groq") {
          return reply.status(400).send({
            error: 'Changing chatProvider is forbidden. Only "groq" is allowed.',
          });
        }
        llmFactory.setChatProvider("groq");
      }
      if (embeddingsProvider) {
        llmFactory.setEmbeddingsProvider(embeddingsProvider as ProviderType);
      }

      const config = llmFactory.getConfig();
      return {
        success: true,
        config: {
          chatProvider: config.chatProvider,
          embeddingsProvider: config.embeddingsProvider,
        },
      };
    } catch (err) {
      request.log.error(err);
      return reply.status(400).send({
        error: "Error changing provider",
        details: String(err),
      });
    }
  });
}
