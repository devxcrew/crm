import type { FastifyInstance } from "fastify";

declare module "fastify" {
  interface FastifyRequest {
    correlationId?: string;
  }
}

export function registerCorrelationContext(app: FastifyInstance): void {
  app.decorateRequest("correlationId", undefined);

  app.addHook("onRequest", async (request, reply) => {
    const correlationHeader = request.headers["x-correlation-id"];
    request.correlationId =
      typeof correlationHeader === "string" && correlationHeader.trim().length > 0
        ? correlationHeader.trim()
        : request.id;
    reply.header("x-correlation-id", request.correlationId);
  });
}
