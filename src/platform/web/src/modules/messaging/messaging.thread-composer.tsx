import { useEffect, useRef, useState } from "react";
import { FileText, Mic, Paperclip, Send, Square, WandSparkles, X } from "lucide-react";
import { Button } from "@codexsun/ui/components/button";
import { useMessagingUserPickerQuery } from "./messaging.hooks";
import type { Message, MessageType, MessagingContact } from "./messaging.types";

type PendingAttachment = { dataUrl: string; kind: MessageType; name: string; size: number; type: string };
const MAX_COMPOSER_HEIGHT = 160;

export function ThreadComposer({ onSend }: { onSend: (content: string, type: MessageType, metadata: Record<string, unknown>, replyToMessageId?: number) => Promise<boolean> }) {
  const [draft, setDraft] = useState("");
  const [selectedMentions, setSelectedMentions] = useState<MessagingContact[]>([]);
  const [attachment, setAttachment] = useState<PendingAttachment | null>(null);
  const [dragging, setDragging] = useState(false);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState("");
  const [reply, setReply] = useState<Message | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mention = mentionQuery(draft);
  const contacts = useMessagingUserPickerQuery(mention ?? "");
  const mentionOptions = mention === null ? [] : contacts.data ?? [];

  useEffect(() => {
    const node = textareaRef.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, MAX_COMPOSER_HEIGHT)}px`;
    node.style.overflowY = node.scrollHeight > MAX_COMPOSER_HEIGHT ? "auto" : "hidden";
  }, [draft]);
  useEffect(() => {
    const reply = (event: Event) => {
      const message = (event as CustomEvent<Message>).detail;
      setReply(message);
      textareaRef.current?.focus();
    };
    window.addEventListener("messaging:reply", reply);
    return () => window.removeEventListener("messaging:reply", reply);
  }, []);
  const pickFile = async (file?: File) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setError("Files must be 10 MB or smaller."); return; }
    setError("");
    const dataUrl = await readDataUrl(file);
    setAttachment({ dataUrl, kind: file.type.startsWith("image/") ? "IMAGE" : file.type.startsWith("audio/") ? "AUDIO" : "FILE", name: file.name, size: file.size, type: file.type || "application/octet-stream" });
  };
  const submit = async () => {
    const content = draft.trim() || attachment?.name || "Voice message";
    if (!content) return;
    const isTask = content.startsWith("/task ");
    const mentions = mentionedContacts(content, selectedMentions);
    const metadata: Record<string, unknown> = {
      mentionNames: mentions.map((contact) => contact.name),
      mentions: mentions.map((contact) => contact.id)
    };
    if (attachment) metadata.attachment = attachment;
    if (isTask) metadata.command = "task";
    if (await onSend(isTask ? content.slice(6).trim() : content, isTask ? "TASK" : attachment?.kind ?? "TEXT", metadata, reply?.id)) { setDraft(""); setSelectedMentions([]); setAttachment(null); setError(""); setReply(null); }
  };
  const toggleRecording = async () => {
    if (recording) { recorderRef.current?.stop(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.onstop = async () => { const blob = new Blob(chunksRef.current, { type: recorder.mimeType }); stream.getTracks().forEach((track) => track.stop()); const file = new File([blob], `voice-${Date.now()}.webm`, { type: blob.type }); if (file.size > 10 * 1024 * 1024) setError("Voice recording is too long. Keep it under 10 MB."); else setAttachment({ dataUrl: await readDataUrl(file), kind: "VOICE", name: file.name, size: file.size, type: file.type }); setRecording(false); };
      recorderRef.current = recorder; recorder.start(); setRecording(true);
    } catch { setError("Microphone access is unavailable."); }
  };
  const transcribe = () => {
    const Recognition = speechRecognition();
    if (!Recognition) { setError("Voice typing is not supported in this browser."); return; }
    const recognition = new Recognition(); recognition.continuous = false; recognition.interimResults = false;
    recognition.onresult = (event) => setDraft((current) => `${current}${current ? " " : ""}${event.results[0]?.[0]?.transcript ?? ""}`);
    recognition.onerror = () => setError("Voice typing could not hear you."); recognition.start();
  };
  return <div className={`relative border-t bg-background p-3 ${dragging ? "ring-2 ring-inset ring-primary" : ""}`} onDragEnter={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); setDragging(false); void pickFile(event.dataTransfer.files[0]); }}>
    {mentionOptions.length ? <div className="absolute bottom-full left-14 mb-2 max-h-72 w-72 overflow-y-auto rounded-xl border bg-popover p-1 shadow-xl">{mentionOptions.map((contact) => <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted" key={contact.id} onClick={() => { setDraft(insertMention(draft, contact.name)); setSelectedMentions((current) => current.some((item) => item.id === contact.id) ? current : [...current, contact]); textareaRef.current?.focus(); }} type="button"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{contact.name[0]}</span><span className="min-w-0"><span className="block truncate font-medium">{contact.name}</span><span className="block truncate text-xs text-muted-foreground">{contact.email}</span></span></button>)}</div> : null}
    {reply ? <div className="mb-2 flex items-center gap-3 rounded-xl border-l-4 border-primary bg-muted/70 px-3 py-2"><span className="min-w-0 flex-1 truncate text-sm">Replying to {reply.senderName}: {reply.content}</span><Button aria-label="Cancel reply" onClick={() => setReply(null)} size="icon" type="button" variant="ghost"><X className="size-4" /></Button></div> : null}
    {attachment ? <div className="mb-2 flex items-center gap-3 rounded-xl bg-muted px-3 py-2"><FileText className="size-5 text-primary" /><span className="min-w-0 flex-1 truncate text-sm">{attachment.name}</span><span className="text-xs text-muted-foreground">{formatBytes(attachment.size)}</span><Button aria-label="Remove attachment" onClick={() => setAttachment(null)} size="icon" type="button" variant="ghost"><X className="size-4" /></Button></div> : null}
    <div className="flex items-end gap-1.5"><input className="hidden" multiple={false} onChange={(event) => void pickFile(event.target.files?.[0])} ref={fileRef} type="file" /><Button aria-label="Attach file" onClick={() => fileRef.current?.click()} size="icon" title="Attach image or file" type="button" variant="ghost"><Paperclip className="size-5" /></Button><div className="min-w-0 flex-1 rounded-2xl border bg-muted/35 px-3 py-2"><textarea aria-label="Message" className="block min-h-[72px] w-full resize-none bg-transparent text-sm leading-6 outline-none placeholder:text-muted-foreground" onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void submit(); } }} placeholder="Message · @mention · /task" ref={textareaRef} rows={3} title="Enter to send · Shift+Enter for a new line" value={draft} /></div><Button aria-label="Voice to text" onClick={transcribe} size="icon" title="Voice to text" type="button" variant="ghost"><WandSparkles className="size-5" /></Button>{draft.trim() || attachment ? <Button aria-label="Send message" className="rounded-full" onClick={() => void submit()} size="icon" type="button"><Send className="size-5" /></Button> : <Button aria-label={recording ? "Stop recording" : "Record voice message"} className={recording ? "rounded-full bg-destructive text-destructive-foreground" : "rounded-full"} onClick={() => void toggleRecording()} size="icon" type="button">{recording ? <Square className="size-4 fill-current" /> : <Mic className="size-5" />}</Button>}</div>
    {error ? <p className="px-12 pt-1 text-xs text-destructive">{error}</p> : null}
  </div>;
}

function mentionQuery(value: string) { const match = value.match(/(?:^|\s)@([^\s@]*)$/u); return match ? match[1] ?? "" : null; }
function insertMention(value: string, name: string) { return value.replace(/@[^\s@]*$/u, `@${name} `); }
function mentionedContacts(value: string, contacts: MessagingContact[]) { return contacts.filter((contact) => value.toLowerCase().includes(`@${contact.name.toLowerCase()}`)); }
function formatBytes(value: number) { return value < 1024 * 1024 ? `${Math.ceil(value / 1024)} KB` : `${(value / 1024 / 1024).toFixed(1)} MB`; }
function readDataUrl(file: File) { return new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file); }); }
type SpeechRecognitionConstructor = new () => { continuous: boolean; interimResults: boolean; onerror: () => void; onresult: (event: { results: ArrayLike<{ [index: number]: { transcript: string } }> }) => void; start: () => void };
function speechRecognition(): SpeechRecognitionConstructor | undefined { const scope = window as typeof window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor }; return scope.SpeechRecognition ?? scope.webkitSpeechRecognition; }
