import type { ConnectionManager } from "./connection-manager.js";

/**
 * Realtime distribution boundary. Phase 1 uses an in-process bus backed by the
 * ConnectionManager (single server). A Redis pub/sub adapter can replace this
 * implementation for multi-server deployments (Phase 7) without changing the
 * gateway or the business services.
 */
export interface RealtimeBus {
  publishToUser(userId: number, frame: string): void;
  publishToConversation(memberIds: number[], conversationId: number, frame: string): void;
}

export class InMemoryRealtimeBus implements RealtimeBus {
  constructor(private readonly manager: ConnectionManager) {}

  publishToUser(userId: number, frame: string): void {
    for (const connection of this.manager.connectionsForUser(userId)) {
      connection.socket.send(frame);
    }
  }

  publishToConversation(memberIds: number[], conversationId: number, frame: string): void {
    for (const connection of this.manager.connectionsForUsers(memberIds)) {
      if (connection.subscriptions.has(conversationId)) {
        connection.socket.send(frame);
      }
    }
  }
}