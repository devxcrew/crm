import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MessageSquareText, Plus, Search, X } from "lucide-react";
import { Button } from "@codexsun/ui/components/button";
import { Input } from "@codexsun/ui/components/input";
import { WorkspacePage } from "@codexsun/ui/workspace/page";
import { MessagingClient } from "./messaging.client";
import { NewConversationComposer } from "./messaging.composer";
import { ThreadComposer } from "./messaging.thread-composer";
import { ConversationList, conversationTitle, MessageBubble, ThreadHeader } from "./messaging.view";
import { useMessagingConversationsQuery, useMessagesQuery } from "./messaging.hooks";
import { createConversation, markConversationRead, reactToMessage, sendMessage } from "./messaging.services";
import type { Conversation, Message, MessageType } from "./messaging.types";

export function MessagingWorkspace({ actorEmail }: { actorEmail: string }) {
  const conversations = useMessagingConversationsQuery();
  const [activeId, setActiveId] = useState<number | null>(null);
  const [composing, setComposing] = useState(false);
  const [openingConversation, setOpeningConversation] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [search, setSearch] = useState("");
  const [messagesByConversation, setMessagesByConversation] = useState<Record<number, Message[]>>({});
  const updateMessages = useCallback((conversationId: number, messages: Message[]) => {
    setMessagesByConversation((current) => ({ ...current, [conversationId]: messages }));
  }, []);
  const refreshConversations = useCallback(() => { void conversations.refetch(); }, [conversations.refetch]);
  const active = conversations.data?.find((item) => item.id === activeId) ?? null;
  const filtered = useMemo(
    () => (conversations.data ?? []).filter((item) => conversationTitle(item, actorEmail).toLowerCase().includes(search.toLowerCase())),
    [actorEmail, conversations.data, search]
  );

  useEffect(() => {
    if (activeId === null && !composing && !openingConversation && conversations.data?.[0]) {
      setActiveId(conversations.data[0].id);
    }
  }, [activeId, composing, conversations.data, openingConversation]);

  return (
    <WorkspacePage className="!w-full !max-w-none !space-y-0 !py-0" technicalName="page.messaging.inbox" title="">
      <div className="relative flex h-[calc(100vh-4rem)] min-h-[540px] overflow-hidden bg-background">
        <aside className={`${sidebarOpen ? "flex" : "hidden"} w-full shrink-0 flex-col border-r bg-background lg:flex lg:w-[360px]`}>
          {composing ? (
            <NewConversationComposer
              onCancel={() => setComposing(false)}
              onCreated={async (id) => {
                setComposing(false);
                setOpeningConversation(true);
                setSidebarOpen(false);
                try {
                  const result = await conversations.refetch();
                  if (result.data?.some((conversation) => conversation.id === id)) setActiveId(id);
                } finally {
                  setOpeningConversation(false);
                }
              }}
            />
          ) : (
            <>
              <div className="flex h-[64px] items-center gap-3 px-4">
                <h2 className="min-w-0 flex-1 text-xl font-semibold leading-tight">Chats</h2>
                <Button aria-label="Start a new chat" onClick={() => { setComposing(true); setSidebarOpen(true); }} size="icon" type="button" variant="ghost"><Plus className="size-5" /></Button>
              </div>
              <label className="relative mx-3 mb-2">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input aria-label="Search conversations" className="h-10 rounded-full border-0 bg-muted pl-9 shadow-none" onChange={(event) => setSearch(event.target.value)} placeholder="Search or start a new chat" value={search} />
              </label>
              <ConversationList actorEmail={actorEmail} conversations={filtered} loading={conversations.isLoading} onSelect={(id) => { setComposing(false); setActiveId(id); setSidebarOpen(false); }} selectedId={activeId} />
            </>
          )}
        </aside>
        <main className={`${sidebarOpen ? "hidden" : "flex"} min-w-0 flex-1 flex-col lg:flex`}>
          {active ? <Thread actorEmail={actorEmail} conversation={active} initialMessages={messagesByConversation[active.id] ?? []} onBack={() => setSidebarOpen(true)} onMessagesChange={updateMessages} onRead={refreshConversations} /> : <EmptyState />}
        </main>
      </div>
    </WorkspacePage>
  );
}

function Thread({ actorEmail, conversation, initialMessages, onBack, onMessagesChange, onRead }: { actorEmail: string; conversation: Conversation; initialMessages: Message[]; onBack: () => void; onMessagesChange: (conversationId: number, messages: Message[]) => void; onRead: () => void }) {
  const [status, setStatus] = useState<"connecting" | "open" | "closed">("connecting");
  const [searchOpen, setSearchOpen] = useState(false);
  const [messageSearch, setMessageSearch] = useState("");
  const messagesRef = useRef(initialMessages);
  const lastReadMessageRef = useRef<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<MessagingClient | null>(null);
  const history = useMessagesQuery(conversation.id);
  const visibleMessages = useMemo(() => {
    const query = messageSearch.trim().toLocaleLowerCase();
    if (!query) return initialMessages;
    return initialMessages.filter((message) => `${message.senderName} ${message.content}`.toLocaleLowerCase().includes(query));
  }, [initialMessages, messageSearch]);
  useEffect(() => { setSearchOpen(false); setMessageSearch(""); }, [conversation.id]);
  useEffect(() => { messagesRef.current = initialMessages; bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [initialMessages]);
  useEffect(() => { if (history.data) onMessagesChange(conversation.id, mergeMessages(messagesRef.current, history.data)); }, [conversation.id, history.data, onMessagesChange]);
  useEffect(() => {
    const last = initialMessages.at(-1);
    if (!last || last.senderEmail === actorEmail) return;
    const readKey = `${conversation.id}:${last.id}`;
    if (lastReadMessageRef.current === readKey) return;
    lastReadMessageRef.current = readKey;
    void markConversationRead(conversation.id, last.id).then(onRead).catch(() => {
      lastReadMessageRef.current = null;
    });
  }, [actorEmail, conversation.id, initialMessages, onRead]);
  useEffect(() => {
    const client = new MessagingClient({ onMessageChanged: (message, id) => { if (id === conversation.id) onMessagesChange(conversation.id, mergeMessages(messagesRef.current, [message])); }, onMessageCreated: (message, id) => { if (id === conversation.id) onMessagesChange(conversation.id, mergeMessages(messagesRef.current, [message])); }, onStatusChange: setStatus, onSyncCompleted: ({ conversationId, messages }) => { if (conversationId === conversation.id) onMessagesChange(conversation.id, mergeMessages(messagesRef.current, messages)); } });
    clientRef.current = client;
    client.subscribe(conversation.id);
    client.requestSync(conversation.id, messagesRef.current.at(-1)?.sequenceNumber ?? 0);
    return () => { clientRef.current = null; client.close(); };
  }, [conversation.id, onMessagesChange]);
  const submit = async (content: string, type: MessageType, metadata: Record<string, unknown>, replyToMessageId?: number) => {
    const clientMessageId = crypto.randomUUID();
    const deliveryMetadata = enrichMentionDelivery(conversation, metadata);
    if (clientRef.current?.isOpen) {
      clientRef.current.sendMessage(conversation.id, clientMessageId, content, type, deliveryMetadata, replyToMessageId);
      await forwardToMentionedUsers(conversation, content, type, deliveryMetadata);
      onRead();
      return true;
    }
    try { const message = await sendMessage(conversation.id, { clientMessageId, content, metadata: deliveryMetadata, ...(replyToMessageId ? { replyToMessageId } : {}), type }); onMessagesChange(conversation.id, mergeMessages(messagesRef.current, [message])); await forwardToMentionedUsers(conversation, content, type, deliveryMetadata); onRead(); return true; }
    catch { return false; }
  };
  return <><ThreadHeader actorEmail={actorEmail} conversation={conversation} onBack={onBack} onSearch={() => setSearchOpen(true)} status={status} />{searchOpen ? <ThreadSearch count={visibleMessages.length} onChange={setMessageSearch} onClose={() => { setSearchOpen(false); setMessageSearch(""); }} value={messageSearch} /> : null}<div aria-live="polite" className="flex-1 space-y-1 overflow-y-auto bg-muted/20 p-4 md:p-6">{history.isLoading && !initialMessages.length ? <p className="text-center text-sm text-muted-foreground">Loading messages…</p> : null}{messageSearch.trim() && !visibleMessages.length ? <p className="py-12 text-center text-sm text-muted-foreground">No matching messages</p> : null}{visibleMessages.map((message, index) => <Fragment key={message.id}>{startsNewDay(message, visibleMessages[index - 1]) ? <DateSeparator value={message.createdAt} /> : null}<MessageBubble message={message} mine={message.senderEmail === actorEmail} onReact={(emoji) => void reactToMessage(conversation.id, message.id, emoji).then((updated) => onMessagesChange(conversation.id, mergeMessages(messagesRef.current, [updated]))) } /></Fragment>)}<div ref={bottomRef} /></div><ThreadComposer onSend={submit} /></>;
}

async function forwardToMentionedUsers(conversation: Conversation, content: string, type: MessageType, metadata: Record<string, unknown>) {
  const mentionedIds = Array.isArray(metadata.mentions) ? metadata.mentions.filter((value): value is number => Number.isInteger(value) && value > 0) : [];
  const directMemberIds = conversation.type === "DIRECT" ? new Set(conversation.members.map((member) => member.userId)) : new Set<number>();
  const recipients = [...new Set(mentionedIds)].filter((userId) => !directMemberIds.has(userId));
  await Promise.allSettled(recipients.map(async (userId) => {
    const directConversation = await createConversation({ memberIds: [userId], title: null, type: "DIRECT" });
    await sendMessage(directConversation.id, {
      clientMessageId: crypto.randomUUID(),
      content,
      metadata: { ...metadata, mentionForwardedFromConversationId: conversation.id, mentionDelivery: true },
      type
    });
  }));
}

function enrichMentionDelivery(conversation: Conversation, metadata: Record<string, unknown>) {
  if (conversation.type !== "DIRECT") return metadata;
  const names = Array.isArray(metadata.mentionNames) ? metadata.mentionNames.filter((value): value is string => typeof value === "string") : [];
  if (!names.length) return metadata;
  return { ...metadata, deliveryRecipients: [...new Set([...conversation.members.map((member) => member.userName), ...names])] };
}

function EmptyState() { return <div className="flex h-full min-h-[620px] flex-1 items-center justify-center bg-muted/10"><span className="grid size-16 place-items-center rounded-full bg-primary/10 text-primary"><MessageSquareText className="size-8" /></span></div>; }
function ThreadSearch({ count, onChange, onClose, value }: { count: number; onChange: (value: string) => void; onClose: () => void; value: string }) { return <div className="flex h-14 items-center gap-2 border-b bg-background px-3 md:px-4"><label className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Search messages in conversation" autoFocus className="h-9 rounded-full bg-muted/60 pl-9 pr-4" onChange={(event) => onChange(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") onClose(); }} placeholder="Search this conversation" value={value} /></label><span aria-live="polite" className="w-16 shrink-0 text-center text-xs text-muted-foreground">{value.trim() ? `${count} found` : ""}</span><Button aria-label="Close message search" onClick={onClose} size="icon" type="button" variant="ghost"><X className="size-4" /></Button></div>; }
function DateSeparator({ value }: { value: string }) { const date = new Date(value); const today = new Date(); const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1); const label = date.toDateString() === today.toDateString() ? "Today" : date.toDateString() === yesterday.toDateString() ? "Yesterday" : date.toLocaleDateString([], { day: "numeric", month: "short", year: date.getFullYear() === today.getFullYear() ? undefined : "numeric" }); return <div className="flex justify-center py-3"><time className="rounded-lg bg-background px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm" dateTime={date.toISOString()}>{label}</time></div>; }
function startsNewDay(message: Message, previous?: Message) { return !previous || new Date(message.createdAt).toDateString() !== new Date(previous.createdAt).toDateString(); }
function mergeMessages(current: Message[], incoming: Message[]) { const byId = new Map(current.map((message) => [message.id, message])); incoming.forEach((message) => byId.set(message.id, message)); return [...byId.values()].sort((a, b) => a.sequenceNumber - b.sequenceNumber); }
