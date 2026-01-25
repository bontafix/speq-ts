import { FastifyInstance } from "fastify";
import { handleUpdate, setWebhook, deleteWebhook, getWebhookInfo } from "../../../telegram";

export async function telegramPlugin(fastify: FastifyInstance) {
  // Webhook endpoint
  fastify.post("/telegram/webhook", {
    schema: {
      description: "Webhook handler for Telegram",
      tags: ["Telegram"],
      response: {
        200: {
          type: "object",
          properties: {
            ok: { type: "boolean" }
          }
        },
        500: {
          type: "object",
          properties: {
            error: { type: "string" }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      await handleUpdate(request.body);
      return { ok: true };
    } catch (err) {
      request.log.error(err);
      reply.status(500).send({ error: "Failed to process webhook" });
    }
  });

  // Set webhook
  fastify.post("/telegram/webhook/set", {
    schema: {
      description: "Set Telegram webhook URL",
      tags: ["Telegram"],
      body: {
        type: "object",
        required: ["webhookUrl"],
        properties: {
          webhookUrl: { type: "string" }
        }
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" }
          }
        },
        500: {
          type: "object",
          properties: {
            error: { type: "string" }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { webhookUrl } = request.body as { webhookUrl: string };
    try {
      await setWebhook(webhookUrl);
      return { success: true, message: `Webhook set to ${webhookUrl}` };
    } catch (err) {
      request.log.error(err);
      reply.status(500).send({ error: "Failed to set webhook" });
    }
  });

  // Delete webhook
  fastify.post("/telegram/webhook/delete", {
    schema: {
      description: "Delete Telegram webhook",
      tags: ["Telegram"],
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" }
          }
        },
        500: {
          type: "object",
          properties: {
            error: { type: "string" }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      await deleteWebhook();
      return { success: true, message: "Webhook deleted" };
    } catch (err) {
      request.log.error(err);
      reply.status(500).send({ error: "Failed to delete webhook" });
    }
  });

  // Get webhook info
  fastify.get("/telegram/webhook/info", {
    schema: {
      description: "Get Telegram webhook info",
      tags: ["Telegram"],
      response: {
        200: {
          type: "object",
          additionalProperties: true
        },
        500: {
          type: "object",
          properties: {
            error: { type: "string" }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const info = await getWebhookInfo();
      return info;
    } catch (err) {
      request.log.error(err);
      reply.status(500).send({ error: "Failed to get webhook info" });
    }
  });
}
