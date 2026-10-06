import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { AppError } from "@codexsun/framework/errors";
import { ConversationService } from "../src/modules/messaging/conversation.service.js";
import { MessageService } from "../src/modules/messaging/message.service.js";
import { InMemoryMessagingRepository } from "../src/modules/messaging/messaging.repositories.js";
import { LocalMessageMediaStorage } from "../src/modules/messaging/message-media-storage.js";
import type { MessagingActor, MessagingContext } from "../src/modules/messaging/messaging.types.js";

function context(actor: MessagingActor): MessagingContext {
  return { actorUser: async () => actor, authorize: async () => {} };
}

function seedRepository(users: MessagingActor[]) {
  return new InMemoryMessagingRepository().seedUsers(
    users.map((user) => ({ email: user.email, id: user.id, name: user.name }))
  );
}

const alice: MessagingActor = { email: "alice@example.com", id: 1, name: "Alice", uuid: "aaaa" };
const bob: MessagingActor = { email: "bob@example.com", id: 2, name: "Bob", uuid: "bbbb" };
const vijay: MessagingActor = { email: "vijay@techmedia.in", id: 3, name: "Vijay", uuid: "vvvv" };

test("conversation creation adds the owner and the invited members", async () => {
  const repository = seedRepository([alice, bob]);
  const service = new ConversationService(context(alice), repository);

  const conversation = await service.create({
    memberIds: [bob.id],
    title: null,
    type: "DIRECT"
  });

  assert.equal(conversation.members.length, 2);
  assert.ok(conversation.members.some((member) => member.userId === alice.id && member.role === "OWNER"));
  assert.ok(conversation.members.some((member) => member.userId === bob.id && member.role === "MEMBER"));
  assert.equal(conversation.lastMessageSequence, 0);
});

test("conversation creation rejects non-active member ids", async () => {
  const repository = seedRepository([alice, bob]);
  const service = new ConversationService(context(alice), repository);

  await assert.rejects(
    service.create({ memberIds: [99], title: null, type: "DIRECT" }),
    (error) => error instanceof AppError && error.statusCode === 400
  );
});

test("messaging contacts search active app users and excludes the actor", async () => {
  const repository = seedRepository([alice, bob]);
  const contacts = await new ConversationService(context(alice), repository).listContacts("bob");
  assert.deepEqual(contacts, [{ email: bob.email, id: bob.id, name: bob.name }]);
  assert.equal((await new ConversationService(context(alice), repository).listContacts("alice")).length, 0);
});

test("creating the same direct contact conversation returns the existing chat", async () => {
  const repository = seedRepository([alice, bob]);
  const service = new ConversationService(context(alice), repository);
  const first = await service.create({ memberIds: [bob.id], type: "DIRECT" });
  const duplicate = await service.create({ memberIds: [bob.id], type: "DIRECT" });
  assert.equal(duplicate.id, first.id);
  assert.equal(repository.conversationCount, 1);
});

test("direct chats open the selected contact and never fall back to another direct chat", async () => {
  const repository = seedRepository([alice, bob, vijay]);
  const service = new ConversationService(context(alice), repository);
  const bobChat = await service.create({ memberIds: [bob.id], type: "DIRECT" });
  const vijayChat = await service.create({ memberIds: [vijay.id], type: "DIRECT" });

  assert.notEqual(vijayChat.id, bobChat.id);
  assert.ok(vijayChat.members.some((member) => member.userId === vijay.id));
  assert.ok(!vijayChat.members.some((member) => member.userId === bob.id));
});

test("direct chats reject self and multiple-contact requests", async () => {
  const repository = seedRepository([alice, bob, vijay]);
  const service = new ConversationService(context(alice), repository);

  await assert.rejects(
    service.create({ memberIds: [alice.id], type: "DIRECT" }),
    (error) => error instanceof AppError && error.statusCode === 400
  );
  await assert.rejects(
    service.create({ memberIds: [bob.id, vijay.id], type: "DIRECT" }),
    (error) => error instanceof AppError && error.statusCode === 400
  );
  assert.equal(repository.conversationCount, 0);
});

test("ordinary members cannot add conversation members", async () => {
  const charlie: MessagingActor = { email: "charlie@example.com", id: 3, name: "Charlie", uuid: "cccc" };
  const repository = seedRepository([alice, bob, charlie]);
  const conversation = await new ConversationService(context(alice), repository).create({ memberIds: [bob.id], type: "GROUP" });
  await assert.rejects(
    new ConversationService(context(bob), repository).addMember(conversation.id, charlie.id, "MEMBER"),
    (error) => error instanceof AppError && error.statusCode === 403
  );
});

test("a non-member cannot read or send into a conversation", async () => {
  const repository = seedRepository([alice, bob]);
  const conversationService = new ConversationService(context(alice), repository);
  const conversation = await conversationService.create({ memberIds: [], type: "GROUP" });

  const messages = new MessageService(context(bob), repository);
  await assert.rejects(
    messages.send(conversation.id, { clientMessageId: "m1", content: "hi", type: "TEXT" }),
    (error) => error instanceof AppError && error.statusCode === 404
  );
  await assert.rejects(
    new ConversationService(context(bob), repository).get(conversation.id),
    (error) => error instanceof AppError && error.statusCode === 404
  );
});

test("messages persist with a monotonic per-conversation sequence", async () => {
  const repository = seedRepository([alice, bob]);
  const conversations = new ConversationService(context(alice), repository);
  const messages = new MessageService(context(alice), repository);
  const conversation = await conversations.create({ memberIds: [bob.id], type: "DIRECT" });

  const first = await messages.send(conversation.id, { clientMessageId: "m1", content: "one", type: "TEXT" });
  const second = await messages.send(conversation.id, { clientMessageId: "m2", content: "two", type: "TEXT" });
  const third = await messages.send(conversation.id, { clientMessageId: "m3", content: "three", type: "TEXT" });

  assert.deepEqual(
    [first.sequenceNumber, second.sequenceNumber, third.sequenceNumber],
    [1, 2, 3]
  );
  assert.equal(conversation.lastMessageSequence, 0);
  const persisted = await repository.listMessages(conversation.id, { limit: 100 });
  assert.equal(persisted.length, 3);
});

test("sending with the same client_message_id is idempotent", async () => {
  const repository = seedRepository([alice, bob]);
  const conversations = new ConversationService(context(alice), repository);
  const messages = new MessageService(context(alice), repository);
  const conversation = await conversations.create({ memberIds: [bob.id], type: "DIRECT" });

  const first = await messages.send(conversation.id, { clientMessageId: "abc", content: "hi", type: "TEXT" });
  const duplicate = await messages.send(conversation.id, { clientMessageId: "abc", content: "hi", type: "TEXT" });

  assert.equal(duplicate.id, first.id);
  assert.equal(duplicate.sequenceNumber, first.sequenceNumber);
  assert.equal(repository.messageCount, 1);
});

test("afterSequence returns only messages newer than the cursor", async () => {
  const repository = seedRepository([alice, bob]);
  const conversations = new ConversationService(context(alice), repository);
  const messages = new MessageService(context(alice), repository);
  const conversation = await conversations.create({ memberIds: [bob.id], type: "DIRECT" });

  await messages.send(conversation.id, { clientMessageId: "m1", content: "one", type: "TEXT" });
  await messages.send(conversation.id, { clientMessageId: "m2", content: "two", type: "TEXT" });

  const missing = await messages.afterSequence(conversation.id, 1, 100);
  assert.equal(missing.length, 1);
  assert.equal(missing[0]?.content, "two");
  assert.equal(missing[0]?.sequenceNumber, 2);
});

test("listMessages returns newest-first history", async () => {
  const repository = seedRepository([alice, bob]);
  const conversations = new ConversationService(context(alice), repository);
  const messages = new MessageService(context(alice), repository);
  const conversation = await conversations.create({ memberIds: [bob.id], type: "DIRECT" });

  await messages.send(conversation.id, { clientMessageId: "m1", content: "one", type: "TEXT" });
  await messages.send(conversation.id, { clientMessageId: "m2", content: "two", type: "TEXT" });

  const page = await messages.list(conversation.id, { limit: 10 });
  assert.equal(page.length, 2);
  assert.equal(page[0]?.content, "two");
  assert.equal(page[1]?.content, "one");
});

test("conversation unread count advances with the member read cursor", async () => {
  const repository = seedRepository([alice, bob]);
  const conversation = await new ConversationService(context(alice), repository).create({ memberIds: [bob.id], type: "DIRECT" });
  const sent = await new MessageService(context(alice), repository).send(conversation.id, { clientMessageId: "unread", content: "please review", type: "TEXT" });
  const before = await new ConversationService(context(bob), repository).get(conversation.id);
  assert.equal(before.unreadCount, 1);
  assert.equal(before.lastMessage?.content, "please review");
  await new MessageService(context(bob), repository).markRead(conversation.id, sent.id);
  const after = await new ConversationService(context(bob), repository).get(conversation.id);
  assert.equal(after.unreadCount, 0);
});

test("structured realtime message metadata persists for tasks and attachments", async () => {
  const repository = seedRepository([alice, bob]);
  const conversation = await new ConversationService(context(alice), repository).create({ memberIds: [bob.id], type: "GROUP" });
  const message = await new MessageService(context(alice), repository).send(conversation.id, {
    clientMessageId: "task-1",
    content: "Review proposal",
    metadata: { command: "task", mentions: [bob.id] },
    type: "TASK"
  });
  assert.deepEqual(message.metadata, { command: "task", mentions: [bob.id] });
});

test("recipient receipts and reactions persist with the message", async () => {
  const repository = seedRepository([alice, bob]);
  const conversation = await new ConversationService(context(alice), repository).create({ memberIds: [bob.id], type: "DIRECT" });
  const messages = new MessageService(context(alice), repository);
  const first = await messages.send(conversation.id, { clientMessageId: "receipt-1", content: "Please review", type: "TEXT" });
  const sent = await messages.send(conversation.id, { clientMessageId: "receipt-2", content: "Please approve", type: "TEXT" });
  assert.equal(sent.receipt.recipientCount, 1);
  assert.equal(sent.status, "SENT");

  const received = await new MessageService(context(bob), repository).markRead(conversation.id, sent.id);
  assert.equal(received.message.status, "READ");
  assert.deepEqual(received.updated.map((message) => message.id), [first.id, sent.id]);
  assert.ok(received.updated.every((message) => message.status === "READ"));
  const reacted = await new MessageService(context(bob), repository).react(conversation.id, sent.id, "👍");
  assert.deepEqual(reacted.reactions, [{ emoji: "👍", userId: bob.id, userName: bob.name }]);
});

test("local message media is stored below its conversation root", async () => {
  const root = await mkdtemp(join(tmpdir(), "techmedia-media-"));
  try {
    const storage = new LocalMessageMediaStorage(root, 1024);
    const stored = await storage.store(42, {
      dataUrl: "data:text/plain;base64,SGVsbG8gVGVjaE1lZGlh",
      name: "welcome.txt",
      type: "text/plain"
    });
    assert.equal(stored.name, "welcome.txt");
    assert.equal((await storage.read(42, stored.key))?.toString(), "Hello TechMedia");
    assert.equal(await storage.read(43, stored.key), undefined);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});
