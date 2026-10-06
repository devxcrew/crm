import assert from "node:assert/strict";
import { test } from "node:test";
import { ConnectionManager, type RealtimeSocket } from "../src/modules/messaging/connection-manager.js";
import { InMemoryRealtimeBus } from "../src/modules/messaging/realtime-bus.js";
import { RealtimeGateway } from "../src/modules/messaging/realtime-gateway.js";
import { InMemoryMessagingRepository } from "../src/modules/messaging/messaging.repositories.js";
import { ConversationService } from "../src/modules/messaging/conversation.service.js";
import type { MessagingActor, MessagingContext } from "../src/modules/messaging/messaging.types.js";

const alice: MessagingActor = { email: "alice@example.com", id: 1, name: "Alice", uuid: "aaaa" };
const bob: MessagingActor = { email: "bob@example.com", id: 2, name: "Bob", uuid: "bbbb" };

type Frame = { eventId: string; eventType: string; payload: Record<string, unknown> };

class FakeSocket implements RealtimeSocket {
  frames: Frame[] = [];
  closed = false;
  send(frame: string) {
    this.frames.push(JSON.parse(frame) as Frame);
  }
  close() {
    this.closed = true;
  }
}

function envelope(eventType: string, payload: Record<string, unknown>) {
  return JSON.stringify({ eventId: `evt-${Math.random()}`, eventType, payload });
}

function plainContext(actor: MessagingActor): MessagingContext {
  return { actorUser: async () => actor, authorize: async () => {} };
}

function buildGateway() {
  const repository = new InMemoryMessagingRepository().seedUsers(
    [alice, bob].map((user) => ({ email: user.email, id: user.id, name: user.name }))
  );
  const manager = new ConnectionManager();
  const bus = new InMemoryRealtimeBus(manager);
  const gateway = new RealtimeGateway({
    actorFromToken: async (token) => [alice, bob].find((user) => user.email === token),
    bus,
    manager,
    repository
  });
  return { manager, repository, gateway };
}

async function connect(
  gateway: RealtimeGateway,
  manager: ConnectionManager,
  socket: FakeSocket,
  actor: MessagingActor
) {
  const connectionId = manager.newConnectionId();
  manager.admit({
    connectionId,
    socket,
    subscriptions: new Set(),
    userEmail: "",
    userId: 0,
    userName: "",
    userUuid: ""
  });
  await gateway.handle(connectionId, envelope("auth", { token: actor.email }));
  return connectionId;
}

test("realtime: authenticating a socket returns auth.success", async () => {
  const { manager, gateway } = buildGateway();
  const socket = new FakeSocket();
  const connectionId = await connect(gateway, manager, socket, alice);

  const authSuccess = socket.frames.find((frame) => frame.eventType === "auth.success");
  assert.ok(authSuccess);
  assert.equal((authSuccess.payload as { userId: number }).userId, alice.id);
  assert.ok(connectionId);
});

test("realtime: a sent message fans out to subscribed member connections", async () => {
  const { manager, repository, gateway } = buildGateway();
  const conversations = new ConversationService(plainContext(alice), repository);
  const conversation = await conversations.create({ memberIds: [bob.id], type: "DIRECT" });

  const aliceSocket = new FakeSocket();
  const bobSocket = new FakeSocket();
  const aliceId = await connect(gateway, manager, aliceSocket, alice);
  const bobId = await connect(gateway, manager, bobSocket, bob);

  await gateway.handle(aliceId, envelope("conversation.subscribe", { conversationId: conversation.id }));
  await gateway.handle(bobId, envelope("conversation.subscribe", { conversationId: conversation.id }));

  await gateway.handle(aliceId, envelope("message.send", {
    clientMessageId: "m1", content: "hello", type: "TEXT", conversationId: conversation.id
  }));

  const bobCreated = bobSocket.frames.find((frame) => frame.eventType === "message.created");
  assert.ok(bobCreated, "recipient should receive the created message");
  const payload = bobCreated.payload as {
    conversationId: number;
    message: { content: string; sequenceNumber: number };
  };
  assert.equal(payload.conversationId, conversation.id);
  assert.equal(payload.message.content, "hello");
  assert.equal(payload.message.sequenceNumber, 1);

  const aliceCreated = aliceSocket.frames.find((frame) => frame.eventType === "message.created");
  assert.ok(aliceCreated, "the sender's own subscribed connection should echo the created message");
});

test("realtime: sync.request returns messages after the known sequence", async () => {
  const { manager, repository, gateway } = buildGateway();
  const conversations = new ConversationService(plainContext(alice), repository);
  const conversation = await conversations.create({ memberIds: [bob.id], type: "DIRECT" });

  const aliceSocket = new FakeSocket();
  const bobSocket = new FakeSocket();
  const aliceId = await connect(gateway, manager, aliceSocket, alice);
  const bobId = await connect(gateway, manager, bobSocket, bob);

  await gateway.handle(aliceId, envelope("conversation.subscribe", { conversationId: conversation.id }));
  await gateway.handle(bobId, envelope("conversation.subscribe", { conversationId: conversation.id }));
  await gateway.handle(aliceId, envelope("message.send", {
    clientMessageId: "m1", content: "first", type: "TEXT", conversationId: conversation.id
  }));
  await gateway.handle(aliceId, envelope("message.send", {
    clientMessageId: "m2", content: "second", type: "TEXT", conversationId: conversation.id
  }));

  // Bob reconnects and requests anything after sequence 1.
  await gateway.handle(bobId, envelope("sync.request", { conversationId: conversation.id, afterSequence: 1 }));

  const sync = bobSocket.frames.find((frame) => frame.eventType === "sync.completed");
  assert.ok(sync);
  const payload = sync.payload as { conversationId: number; latestSequence: number; messages: Array<{ content: string }> };
  assert.equal(payload.latestSequence, 2);
  assert.equal(payload.messages.length, 1);
  assert.equal(payload.messages[0]?.content, "second");
});

test("realtime: unauthenticated sockets are rejected before business work", async () => {
  const { manager, repository, gateway } = buildGateway();
  const conversations = new ConversationService(plainContext(alice), repository);
  const conversation = await conversations.create({ memberIds: [bob.id], type: "DIRECT" });

  const socket = new FakeSocket();
  const connectionId = manager.newConnectionId();
  manager.admit({
    connectionId,
    socket,
    subscriptions: new Set(),
    userEmail: "",
    userId: 0,
    userName: "",
    userUuid: ""
  });

  await gateway.handle(connectionId, envelope("message.send", {
    clientMessageId: "m1", content: "hi", type: "TEXT", conversationId: conversation.id
  }));

  const error = socket.frames.find((frame) => frame.eventType === "error");
  assert.ok(error);
  assert.equal((error.payload as { code: string }).code, "UNAUTHENTICATED");
  assert.equal(repository.messageCount, 0);
});

test("realtime: malformed and unsupported frames are handled without crashing", async () => {
  const { manager, gateway } = buildGateway();
  const socket = new FakeSocket();
  const connectionId = await connect(gateway, manager, socket, alice);

  await gateway.handle(connectionId, "not-json");
  await gateway.handle(connectionId, envelope("unknown.event", {}));

  const error = socket.frames.find((frame) => frame.eventType === "error");
  assert.ok(error);
});

test("realtime: duplicate sends with the same client_message_id persist once", async () => {
  const { manager, repository, gateway } = buildGateway();
  const conversations = new ConversationService(plainContext(alice), repository);
  const conversation = await conversations.create({ memberIds: [bob.id], type: "DIRECT" });

  const aliceSocket = new FakeSocket();
  const aliceId = await connect(gateway, manager, aliceSocket, alice);
  await gateway.handle(aliceId, envelope("conversation.subscribe", { conversationId: conversation.id }));

  const frame = envelope("message.send", { clientMessageId: "dup", content: "hi", type: "TEXT", conversationId: conversation.id });
  await gateway.handle(aliceId, frame);
  await gateway.handle(aliceId, frame);

  assert.equal(repository.messageCount, 1);
});