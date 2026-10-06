import { useEffect, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence } from "framer-motion";
import { ArchiveIcon, BotIcon, FilePenLineIcon, MenuIcon, MicIcon, PanelLeftCloseIcon, PlusIcon, SendIcon, XIcon } from "lucide-react";
import { Button } from "@codexsun/ui/components/button";
import { Textarea } from "@codexsun/ui/components/textarea";
import { HoneyMessageBubble, HoneyThinking } from "./honey.message";
import { archiveHoneyConversation, getHoneyConversation, getHoneyOverview, listHoneyConversations, sendHoneyMessage } from "./honey.services";
import { useHoneyVoice } from "./honey.voice";
import { TemaFace } from "./tema-face";

export function HoneyWorkspace() {
  const client = useQueryClient();
  const endRef = useRef<HTMLDivElement>(null);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState<"assistant" | "content-writer">("assistant");
  const [newConversation, setNewConversation] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const threads = useQuery({ queryKey: ["honey", "threads"], queryFn: listHoneyConversations });
  const overview = useQuery({ queryKey: ["honey", "overview"], queryFn: getHoneyOverview });
  const activeId = newConversation ? null : threadId ?? threads.data?.[0]?.id ?? null;
  const conversation = useQuery({ enabled: Boolean(activeId), queryFn: () => getHoneyConversation(activeId!), queryKey: ["honey", "thread", activeId] });
  const archive = useMutation({
    mutationFn: archiveHoneyConversation,
    onSuccess: async (_result, id) => {
      if (activeId === id) {
        setNewConversation(true);
        setThreadId(null);
      }
      await Promise.all([
        client.invalidateQueries({ queryKey: ["honey", "threads"] }),
        client.invalidateQueries({ queryKey: ["honey", "overview"] })
      ]);
    }
  });
  const send = useMutation({
    mutationFn: (body: string) => sendHoneyMessage(body, mode, activeId),
    onSuccess: async (data) => {
      setThreadId(data.id);
      setNewConversation(false);
      client.setQueryData(["honey", "thread", data.id], data);
      await client.invalidateQueries({ queryKey: ["honey", "threads"] });
      await client.invalidateQueries({ queryKey: ["honey", "overview"] });
    }
  });
  const voice = useHoneyVoice(setMessage);
  const pendingMessage = send.variables ?? "";

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [conversation.data?.messages, send.isPending]);
  function submit() {
    const body = message.trim();
    if (!body || send.isPending) return;
    setMessage("");
    send.mutate(body);
  }
  return <section className="flex min-h-[calc(100svh-9rem)] overflow-hidden bg-background">
    {drawerOpen ? <ConversationDrawer activeId={activeId} archivingId={archive.variables} items={threads.data ?? []} onArchive={(id) => archive.mutate(id)} onClose={() => setDrawerOpen(false)} onNew={() => { setNewConversation(true); setThreadId(null); setMessage(""); }} onSelect={(id) => { setNewConversation(false); setThreadId(id); }} /> : null}
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="flex min-h-16 items-center gap-3 border-b px-4 sm:px-5">
        {!drawerOpen ? <Button aria-label="Show conversations" onClick={() => setDrawerOpen(true)} size="icon" type="button" variant="ghost"><MenuIcon /></Button> : null}
        <TemaFace size="header" /><div><h1 className="font-semibold">TEMA</h1><p className="text-xs text-muted-foreground">CRM assistant and content team</p></div>
        <HoneyOverview overview={overview.data} />
        <div className="ml-auto flex rounded-lg border p-1"><ModeButton active={mode === "assistant"} icon={<BotIcon />} label="Assistant" onClick={() => setMode("assistant")} /><ModeButton active={mode === "content-writer"} icon={<FilePenLineIcon />} label="Content writer" onClick={() => setMode("content-writer")} /></div>
      </header>
      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-[max(1.5rem,calc((100%-48rem)/2))]">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
          {!conversation.data?.messages.length && !send.isPending ? <Welcome mode={mode} /> : null}
          <AnimatePresence initial={false}>{conversation.data?.messages.map((item) => <HoneyMessageBubble item={item} key={item.id} />)}</AnimatePresence>
          {send.isPending && pendingMessage ? <HoneyMessageBubble item={{ body: pendingMessage, createdAt: new Date().toISOString(), id: "pending", metadata: {}, role: "user" }} /> : null}
          {send.isPending ? <HoneyThinking /> : null}
          {send.error ? <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{send.error.message}</p> : null}<div ref={endRef} />
        </div>
      </div>
      <GrowingComposer error={voice.error} listening={voice.listening} message={message} mode={mode} onChange={setMessage} onSubmit={submit} onVoice={voice.toggle} pending={send.isPending} preview={voice.preview} voiceSupported={voice.supported} />
    </div>
  </section>;
}

function HoneyOverview({ overview }: { overview: { conversationCount: number; promptCount: number; responseCount: number } | undefined }) {
  if (!overview) return null;
  return <dl className="ml-3 hidden items-center gap-3 text-xs text-muted-foreground lg:flex">
    <div><dt className="sr-only">Conversations</dt><dd><strong className="text-foreground">{overview.conversationCount}</strong> chats</dd></div>
    <div><dt className="sr-only">Prompts</dt><dd><strong className="text-foreground">{overview.promptCount}</strong> prompts</dd></div>
    <div><dt className="sr-only">AI responses</dt><dd><strong className="text-foreground">{overview.responseCount}</strong> AI replies</dd></div>
  </dl>;
}

function GrowingComposer({
  error,
  listening,
  message,
  mode,
  onChange,
  onSubmit,
  onVoice,
  pending,
  preview,
  voiceSupported
}: {
  error: string;
  listening: boolean;
  message: string;
  mode: "assistant" | "content-writer";
  onChange: (value: string) => void;
  onSubmit: () => void;
  onVoice: () => void;
  pending: boolean;
  preview: string;
  voiceSupported: boolean;
}) {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = "auto";
    input.style.height = `${input.scrollHeight}px`;
  }, [message]);

  return <form className="border-t bg-background p-3 sm:p-4" onSubmit={(event) => {
    event.preventDefault();
    onSubmit();
  }}>
    <div className="mx-auto w-full sm:w-[90%]">
      {listening ? <div className="mb-2 flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-950"><MicIcon className="size-4 animate-pulse" /><span className="min-w-0 flex-1 truncate">{preview || "Listening…"}</span><XIcon className="size-4" /></div> : null}
      {message ? <div className="flex justify-end pb-2"><Button disabled={pending} onClick={() => onChange("")} size="sm" type="button" variant="ghost">Clear</Button></div> : null}
      <div className="flex items-end gap-2 rounded-2xl border bg-card p-2 shadow-sm focus-within:ring-2 focus-within:ring-primary/25">
        <Textarea
          aria-label="Message TEMA"
          className="min-h-11 flex-1 resize-none overflow-hidden border-0 bg-transparent shadow-none focus-visible:ring-0"
          disabled={pending}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || event.shiftKey) return;
            event.preventDefault();
            onSubmit();
          }}
          placeholder={mode === "content-writer" ? "Describe your audience, goal, facts, and tone…" : "Ask TEMA about your work…"}
          ref={inputRef}
          rows={1}
          value={message}
        />
        <Button aria-label={listening ? "Stop voice input" : "Start voice input"} disabled={!voiceSupported || pending} onClick={onVoice} size="icon" title="Voice input" type="button" variant="ghost"><MicIcon className={listening ? "animate-pulse" : ""} /></Button>
        <Button aria-label="Send message" disabled={!message.trim() || pending} size="icon" type="submit"><SendIcon /></Button>
      </div>
      {error ? <p className="pt-2 text-xs text-destructive">{error}</p> : !voiceSupported ? <p className="pt-2 text-xs text-muted-foreground">Voice input is available in Chrome or Edge after microphone access is allowed.</p> : null}
    </div>
  </form>;
}

void Composer;

function ConversationDrawer({ activeId, archivingId, items, onArchive, onClose, onNew, onSelect }: { activeId: string | null; archivingId: string | undefined; items: Array<{ id: string; title: string; updatedAt: string }>; onArchive: (id: string) => void; onClose: () => void; onNew: () => void; onSelect: (id: string) => void }) { return <aside className="hidden w-72 shrink-0 flex-col border-r bg-muted/20 p-3 md:flex"><div className="flex gap-2"><Button className="flex-1 justify-start" onClick={onNew} type="button" variant="outline"><PlusIcon />New conversation</Button><Button aria-label="Hide conversations" onClick={onClose} size="icon" type="button" variant="ghost"><PanelLeftCloseIcon /></Button></div><div className="mt-4 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Chat history</div><div className="mt-2 space-y-1 overflow-y-auto">{items.map((item) => <div className={`group flex items-center rounded-xl pr-1 transition ${activeId === item.id ? "bg-amber-100 text-amber-950" : "hover:bg-muted"}`} key={item.id}><button className="min-w-0 flex-1 truncate px-3 py-2.5 text-left text-sm" onClick={() => onSelect(item.id)} type="button">{item.title}</button><Button aria-label={`Archive ${item.title}`} className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100" disabled={archivingId === item.id} onClick={() => onArchive(item.id)} size="icon" title="Archive conversation" type="button" variant="ghost"><ArchiveIcon /></Button></div>)}</div></aside>; }
function ModeButton({ active, icon, label, onClick }: { active: boolean; icon: ReactNode; label: string; onClick: () => void }) { return <Button className="hidden sm:inline-flex" onClick={onClick} size="sm" type="button" variant={active ? "default" : "ghost"}>{icon}{label}</Button>; }
function Welcome({ mode }: { mode: "assistant" | "content-writer" }) { return <div className="m-auto max-w-md text-center"><TemaFace size="welcome" /><h2 className="pt-4 text-xl font-semibold">How can TEMA help?</h2><p className="pt-2 text-sm leading-6 text-muted-foreground">{mode === "content-writer" ? "Describe your audience, goal, facts, and tone. TEMA will organize a clear draft." : "Ask about CRM work, estimates, quotations, iShop, or concise business content."}</p></div>; }
function Composer({ error, listening, message, mode, onChange, onSubmit, onVoice, pending, preview, voiceSupported }: { error: string; listening: boolean; message: string; mode: "assistant" | "content-writer"; onChange: (value: string) => void; onSubmit: () => void; onVoice: () => void; pending: boolean; preview: string; voiceSupported: boolean }) { return <form className="border-t bg-background p-3 sm:p-4" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}><div className="mx-auto max-w-3xl">{listening ? <div className="mb-2 flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-950"><MicIcon className="size-4 animate-pulse" /><span className="min-w-0 flex-1 truncate">{preview || "Listening…"}</span><XIcon className="size-4" /></div> : null}<div className="flex items-end gap-2 rounded-2xl border bg-card p-2 shadow-sm focus-within:ring-2 focus-within:ring-primary/25"><Textarea aria-label="Message TEMA" className="min-h-11 max-h-36 flex-1 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0" disabled={pending} onChange={(event) => onChange(event.target.value)} placeholder={mode === "content-writer" ? "Describe the audience, goal, facts, and tone…" : "Ask TEMA about your work…"} rows={1} value={message} /><Button aria-label={listening ? "Stop voice input" : "Start voice input"} disabled={!voiceSupported || pending} onClick={onVoice} size="icon" title="Voice input" type="button" variant="ghost"><MicIcon className={listening ? "animate-pulse" : ""} /></Button><Button aria-label="Send message" disabled={!message.trim() || pending} size="icon" type="submit"><SendIcon /></Button></div>{error ? <p className="pt-2 text-xs text-destructive">{error}</p> : !voiceSupported ? <p className="pt-2 text-xs text-muted-foreground">Voice input is available in Chrome or Edge after microphone access is allowed.</p> : null}</div></form>; }
