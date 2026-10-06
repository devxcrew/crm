import { useEffect, useRef, useState } from "react";
import { CheckSquare, ChevronDown, Copy, Forward, Info, Pin, Reply, SmilePlus, Star, Trash2 } from "lucide-react";
import type { Message } from "./messaging.types";

const reactions = ["👍", "❤️", "😂", "😮", "😢", "🙏", "😀", "😍", "🥳", "🤔", "👏", "🔥", "✅", "💯", "🎉", "👀", "💪", "🙌"] as const;

export function MessageActions({ message, mine, onHide, onReact }: { message: Message; mine: boolean; onHide: () => void; onReact: (emoji: string | null) => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [starred, setStarred] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuOpen && !emojiOpen) return;
    const close = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node)) { setMenuOpen(false); setEmojiOpen(false); } };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [emojiOpen, menuOpen]);
  useEffect(() => {
    const open = (event: Event) => { if ((event as CustomEvent<number>).detail === message.id) setMenuOpen(true); };
    window.addEventListener("messaging:open-actions", open);
    return () => window.removeEventListener("messaging:open-actions", open);
  }, [message.id]);
  const copy = () => void navigator.clipboard.writeText(message.content);
  const forward = async () => { if (navigator.share) await navigator.share({ text: message.content }); else copy(); };
  const run = (action: () => void) => { setMenuOpen(false); action(); };
  const ownReaction = message.reactions.at(-1)?.emoji ?? null;
  const react = (emoji: string) => onReact(emoji === ownReaction ? null : emoji);
  return <div ref={rootRef}>
    <button aria-expanded={emojiOpen} aria-label="React to message" className={`absolute top-1/2 z-20 grid size-8 -translate-y-1/2 place-items-center rounded-full border bg-background text-muted-foreground opacity-0 shadow-sm transition-opacity hover:text-foreground group-hover:opacity-100 group-focus-within:opacity-100 ${mine ? "right-[calc(100%+0.5rem)]" : "left-[calc(100%+0.5rem)]"}`} onClick={() => setEmojiOpen((open) => !open)} type="button"><SmilePlus className="size-4" /></button>
    {emojiOpen ? <div className={`absolute bottom-[calc(100%-2rem)] z-50 grid w-56 grid-cols-6 gap-1 rounded-xl border bg-popover p-2 shadow-xl ${mine ? "right-[calc(100%+0.5rem)]" : "left-[calc(100%+0.5rem)]"}`} role="menu">{reactions.map((item) => <button aria-label={`React ${item}`} className="grid size-8 place-items-center rounded-lg text-lg transition-transform hover:scale-110 hover:bg-muted" key={item} onClick={() => { react(item); setEmojiOpen(false); }} type="button">{item}</button>)}</div> : null}
    <button aria-expanded={menuOpen} aria-label="Message actions" className="absolute right-1 top-1 z-20 grid size-7 place-items-center rounded-full bg-inherit opacity-0 transition-opacity hover:bg-black/5 group-hover:opacity-100 focus:opacity-100" onClick={() => setMenuOpen((open) => !open)} type="button"><ChevronDown className="size-4" /></button>
    {menuOpen ? <div className={`absolute bottom-[calc(100%-2rem)] z-50 w-56 overflow-hidden rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-xl ${mine ? "right-1" : "left-1"}`} role="menu">
      <div className="flex items-center gap-1 border-b border-border px-1 pb-2 pt-0.5">{reactions.slice(0, 6).map((item) => <button aria-label={`React ${item}`} className="grid size-8 place-items-center rounded-full text-lg transition-colors hover:bg-muted" key={item} onClick={() => { react(item); setMenuOpen(false); }} type="button">{item}</button>)}</div>
      <MenuItem icon={Info} label="Message info" onClick={() => run(() => window.alert(`${message.senderName}\n${new Date(message.createdAt).toLocaleString()}\n${message.status}`))} />
      <MenuItem icon={Reply} label="Reply" onClick={() => run(() => window.dispatchEvent(new CustomEvent("messaging:reply", { detail: message })))} />
      <MenuItem icon={Copy} label="Copy" onClick={() => run(copy)} />
      <MenuItem icon={Forward} label="Forward" onClick={() => run(() => void forward())} />
      <div className="my-1 h-px bg-border" />
      <MenuItem icon={Pin} label={pinned ? "Unpin" : "Pin"} onClick={() => run(() => setPinned(!pinned))} />
      <MenuItem icon={Star} label={starred ? "Unstar" : "Star"} onClick={() => run(() => setStarred(!starred))} />
      <MenuItem icon={CheckSquare} label="Select" onClick={() => setMenuOpen(false)} />
      {mine ? <><div className="my-1 h-px bg-border" /><MenuItem destructive icon={Trash2} label="Delete" onClick={() => run(onHide)} /></> : null}
    </div> : null}
    {message.reactions.length ? <span className={`absolute -bottom-3 rounded-full border bg-background px-1.5 py-0.5 text-sm shadow-sm ${mine ? "right-2" : "left-2"}`}>{[...new Set(message.reactions.map((item) => item.emoji))].join(" ")}</span> : null}
    {pinned || starred ? <span className="absolute -top-2 left-2 flex gap-1 rounded-full bg-background px-1.5 py-0.5 text-muted-foreground shadow-sm">{pinned ? <Pin className="size-3" /> : null}{starred ? <Star className="size-3 fill-current" /> : null}</span> : null}
  </div>;
}

function MenuItem({ destructive = false, icon: Icon, label, onClick }: { destructive?: boolean; icon: typeof Info; label: string; onClick: () => void }) {
  return <button className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none ${destructive ? "text-destructive" : ""}`} onClick={onClick} role="menuitem" type="button"><Icon className="size-4 shrink-0" />{label}</button>;
}
