import type { FastifyInstance } from "fastify";
import websocket from "@fastify/websocket";
import type { WebSocket as WsSocket } from "ws";
import type { RealtimeConnection, RealtimeSocket } from "./connection-manager.js";
import type { ConnectionManager } from "./connection-manager.js";
import type { RealtimeGateway } from "./realtime-gateway.js";

/**
 * WebSocket transport for the messaging engine. This layer owns only frame
 * I/O and socket lifecycle; every frame is handed to the transport-agnostic
 * RealtimeGateway, which owns protocol routing and delegates to services.
 */
export async function registerMessagingWebSocket(app: FastifyInstance, deps: {
  gateway: RealtimeGateway;
  manager: ConnectionManager;
}): Promise<void> {
  await app.register(websocket, { options: { maxPayload: 128 * 1024 } });

  app.get("/ws/messaging", { websocket: true }, (socket: WsSocket) => {
    const realtimeSocket: RealtimeSocket = {
      close: (code, reason) => socket.close(code, reason),
      send: (frame) => {
        if (socket.readyState === socket.OPEN) socket.send(frame);
      }
    };
    const connectionId = deps.manager.newConnectionId();
    const realtimeConnection: RealtimeConnection = {
      connectionId,
      socket: realtimeSocket,
      subscriptions: new Set(),
      userEmail: "",
      userId: 0,
      userName: "",
      userUuid: ""
    };
    deps.manager.admit(realtimeConnection);

    socket.on("message", (data) => {
      const raw = data.toString();
      void deps.gateway.handle(connectionId, raw).catch(() => {
        realtimeSocket.send(
          JSON.stringify({
            eventId: connectionId,
            eventType: "error",
            payload: { code: "INTERNAL", message: "Realtime processing failed." },
            timestamp: new Date().toISOString()
          })
        );
      });
    });

    socket.on("close", () => {
      deps.manager.remove(connectionId);
    });
    socket.on("error", () => {
      deps.manager.remove(connectionId);
      socket.close(1011, "Realtime connection error");
    });
  });
}