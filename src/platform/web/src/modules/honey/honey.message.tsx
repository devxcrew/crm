import { useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Share2Icon, ThumbsDownIcon, ThumbsUpIcon, Volume2Icon } from "lucide-react";
import { Button } from "@codexsun/ui/components/button";
import type { HoneyMessage } from "./honey.services";
import { speakHoneyReply } from "./honey.voice";
import { TemaFace } from "./tema-face";

export function HoneyMessageBubble({ item }: { item: HoneyMessage }) {
  const assistant = item.role === "assistant";
  const [feedback, setFeedback] = useState<"down" | "up" | null>(null);
  return <motion.article animate={{ opacity: 1, y: 0 }} className={`flex gap-2 ${assistant ? "items-start justify-start" : "items-end justify-end"}`} initial={{ opacity: 0, y: 10 }} transition={{ duration: 0.22 }}>
    {assistant ? <TemaFace /> : null}
    <div className={`group max-w-[min(44rem,86%)] rounded-2xl px-4 py-3 text-sm leading-6 ${assistant ? "rounded-bl-md bg-muted/35 text-card-foreground" : "rounded-br-md bg-primary text-primary-foreground"}`}>
      <p className="whitespace-pre-wrap">{item.body}</p>
      {assistant ? <div className="mt-2 flex items-center gap-1 pt-1 text-xs text-muted-foreground opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100"><span className="mr-auto">{new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" }).format(new Date(item.createdAt))}</span><ReplyAction active={feedback === "up"} icon={<ThumbsUpIcon />} label="Helpful" onClick={() => setFeedback("up")} /><ReplyAction active={feedback === "down"} icon={<ThumbsDownIcon />} label="Not helpful" onClick={() => setFeedback("down")} /><ReplyAction icon={<Share2Icon />} label="Copy reply" onClick={() => void shareReply(item.body)} /><ReplyAction icon={<Volume2Icon />} label="Read TEMA reply aloud" onClick={() => speakHoneyReply(item.body)} /></div> : null}
    </div>
  </motion.article>;
}

function ReplyAction({ active = false, icon, label, onClick }: { active?: boolean; icon: ReactNode; label: string; onClick: () => void }) {
  return <Button aria-label={label} className={active ? "h-7 w-7 text-primary" : "h-7 w-7"} onClick={onClick} size="icon" title={label} type="button" variant="ghost">{icon}</Button>;
}

async function shareReply(body: string) {
  if (navigator.share) {
    await navigator.share({ text: body, title: "TEMA reply" });
    return;
  }
  await navigator.clipboard?.writeText(body);
}

export function HoneyThinking() {
  return <motion.div animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 py-1 text-sm text-muted-foreground" initial={{ opacity: 0, y: 8 }}><span className="animate-pulse"><TemaFace /></span><span>TEMA is preparing a clear response<span className="inline-flex w-5 justify-between pl-1">{[0, 1, 2].map((dot) => <i className="size-1 animate-bounce rounded-full bg-current" key={dot} style={{ animationDelay: `${dot * 120}ms` }} />)}</span></span></motion.div>;
}
