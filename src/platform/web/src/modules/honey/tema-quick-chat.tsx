import { ArrowUpIcon, ExternalLinkIcon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { getHoneyConversation, listHoneyConversations, sendHoneyMessage, type HoneyConversation } from "./honey.services";

export function TemaQuickChat({ initialMessage = "", onClose, onOpen }: { initialMessage?: string; onClose: () => void; onOpen: () => void }) {
  const [conversation, setConversation] = useState<HoneyConversation | null>(null);
  const [message, setMessage] = useState(initialMessage);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    void listHoneyConversations().then((items) => items[0] ? getHoneyConversation(items[0].id) : null).then(setConversation).catch(() => setError("TEMA chat is unavailable."));
  }, []);

  async function send() {
    const body = message.trim();
    if (!body || pending) return;
    setMessage(""); setPending(true); setError("");
    try { setConversation(await sendHoneyMessage(body, "assistant", conversation?.id ?? null)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "TEMA could not answer."); }
    finally { setPending(false); }
  }

  const preview = conversation?.messages.slice(-3) ?? [];
  return <section className="pointer-events-auto absolute bottom-full left-1/2 mb-3 flex w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 flex-col overflow-hidden rounded-3xl border border-violet-200/70 bg-background/95 shadow-xl backdrop-blur" onPointerDown={(event) => event.stopPropagation()}>
    <header className="flex items-center gap-2 border-b px-4 py-3"><div className="flex-1"><h2 className="text-sm font-semibold">TEMA</h2><p className="text-xs text-muted-foreground">Quick business agent</p></div><button aria-label="Open full TEMA chat" className="rounded-full p-2 hover:bg-muted" onClick={onOpen} type="button"><ExternalLinkIcon className="size-4" /></button><button aria-label="Close quick chat" className="rounded-full p-2 hover:bg-muted" onClick={onClose} type="button"><XIcon className="size-4" /></button></header>
    <div className="flex max-h-60 flex-col gap-2 overflow-y-auto p-3">{preview.length ? preview.map((item) => <div className={`max-w-[88%] rounded-2xl px-3 py-2 text-xs leading-5 ${item.role === "user" ? "ml-auto rounded-br-md bg-foreground text-background" : "rounded-bl-md bg-violet-100 text-violet-950"}`} key={item.id}>{item.body}</div>) : <p className="px-2 py-4 text-center text-xs text-muted-foreground">Hi, I’m TEMA. How can I help?</p>}{pending ? <p className="text-xs text-muted-foreground">TEMA is thinking…</p> : null}{error ? <p className="text-xs text-destructive">{error}</p> : null}</div>
    <form className="flex gap-2 border-t p-3" onSubmit={(event) => { event.preventDefault(); void send(); }}><input aria-label="Message TEMA" className="h-9 min-w-0 flex-1 rounded-full border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-violet-400" onChange={(event) => setMessage(event.target.value)} placeholder="Ask TEMA…" value={message} /><button aria-label="Send to TEMA" className="flex size-9 items-center justify-center rounded-full bg-violet-600 text-white disabled:opacity-50" disabled={!message.trim() || pending} type="submit"><ArrowUpIcon className="size-4" /></button></form>
  </section>;
}
