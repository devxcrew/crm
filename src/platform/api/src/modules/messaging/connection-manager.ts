import { randomUUID } from "node:crypto";

/** Transport abstraction. The WebSocket adapter provides a socket that can
 * send serialized frames; the realtime layer never touches a socket directly
 * beyond this interface. */
export type RealtimeSocket = {
  close(code?: number, reason?: string): void;
  send(frame: string): void;
};

export type RealtimeConnection = {
  connectionId: string;
  socket: RealtimeSocket;
  subscriptions: Set<number>;
  userEmail: string;
  userId: number;
  userName: string;
  userUuid: string;
};

/**
 * Tracks user -> connections -> subscriptions. A single user may hold many
 * simultaneous connections (browser, desktop, mobile, tablet), and each
 * connection may subscribe to many conversations.
 */
export class ConnectionManager {
  private readonly connections = new Map<string, RealtimeConnection>();
  private readonly byUser = new Map<number, Set<string>>();

  add(connection: RealtimeConnection): void {
    this.connections.set(connection.connectionId, connection);
    let ids = this.byUser.get(connection.userId);
    if (!ids) {
      ids = new Set();
      this.byUser.set(connection.userId, ids);
    }
    ids.add(connection.connectionId);
  }

  /** Registers a socket before authentication so the gateway can resolve the
   * connection and attach its identity. Not visible to user fan-out. */
  admit(connection: RealtimeConnection): void {
    this.connections.set(connection.connectionId, connection);
  }

  remove(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;
    this.connections.delete(connectionId);
    const ids = this.byUser.get(connection.userId);
    ids?.delete(connectionId);
    if (ids && ids.size === 0) this.byUser.delete(connection.userId);
  }

  get(connectionId: string): RealtimeConnection | undefined {
    return this.connections.get(connectionId);
  }

  subscribe(connectionId: string, conversationId: number): void {
    this.connections.get(connectionId)?.subscriptions.add(conversationId);
  }

  unsubscribe(connectionId: string, conversationId: number): void {
    this.connections.get(connectionId)?.subscriptions.delete(conversationId);
  }

  connectionsForUser(userId: number): RealtimeConnection[] {
    const ids = this.byUser.get(userId) ?? new Set<string>();
    const result: RealtimeConnection[] = [];
    for (const id of ids) {
      const connection = this.connections.get(id);
      if (connection) result.push(connection);
    }
    return result;
  }

  connectionsForUsers(userIds: Iterable<number>): RealtimeConnection[] {
    const seen = new Set<string>();
    const result: RealtimeConnection[] = [];
    for (const userId of userIds) {
      for (const connection of this.connectionsForUser(userId)) {
        if (!seen.has(connection.connectionId)) {
          seen.add(connection.connectionId);
          result.push(connection);
        }
      }
    }
    return result;
  }

  activeConnectionCount(): number {
    return this.connections.size;
  }

  newConnectionId(): string {
    return randomUUID();
  }
}