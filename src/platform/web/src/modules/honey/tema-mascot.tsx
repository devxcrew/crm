import { animate, motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import { AudioWaveformIcon, CheckIcon, EllipsisVerticalIcon, HandIcon, LaptopIcon, MessageCircleIcon, MoveHorizontalIcon, PauseIcon, SparklesIcon } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@codexsun/ui/components/dropdown-menu";
import { subscribeToTemaActivity, type TemaActivity } from "../../shared/tema-activity";
import { TemaQuickChat } from "./tema-quick-chat";
import { clampTemaPosition, homePosition, movementFor, nextRoamingPosition, TEMA_HEIGHT, TEMA_WIDTH, travelDuration, type TemaMovement, type TemaPosition } from "./tema-motion";
import { useHoneyVoice } from "./honey.voice";

const FRAME_WIDTH = 192;
const FRAME_HEIGHT = 208;
const SCALE = 0.68;
const POSITION_KEY = "techmedia_tema_position";
const BEHAVIOR_KEY = "techmedia_tema_behavior";
const WELCOME_KEY = "techmedia_tema_welcomed";
const MOTION: Record<TemaActivity, { frames: number; label: string; row: number; speed: number }> = {
  failed: { frames: 8, label: "That job needs attention", row: 5, speed: 180 },
  idle: { frames: 6, label: "Ask TEMA", row: 0, speed: 420 },
  review: { frames: 6, label: "Job completed", row: 8, speed: 190 },
  running: { frames: 6, label: "TEMA is working", row: 7, speed: 150 },
  waiting: { frames: 6, label: "Waiting for the result", row: 6, speed: 280 }
};

type Point = { x: number; y: number };
type TemaMoment = "jump" | "wave" | "work" | null;

const MOMENTS = {
  jump: { frames: 5, label: "A quick energy boost!", row: 4, speed: 145 },
  wave: { frames: 4, label: "Hello! I’m here when you need me.", row: 3, speed: 230 },
  work: { frames: 6, label: "I’m checking the laptop.", row: 7, speed: 210 }
} as const;

export function TemaMascot({ onOpen }: { onOpen: () => void }) {
  const [activity, setActivity] = useState<TemaActivity>("idle");
  const [behavior, setBehavior] = useState<"roam" | "stay">(() => localStorage.getItem(BEHAVIOR_KEY) === "stay" ? "stay" : "roam");
  const [chatOpen, setChatOpen] = useState(false);
  const [climbing, setClimbing] = useState(false);
  const [frame, setFrame] = useState(0);
  const [position, setPosition] = useState<Point>(() => loadPosition());
  const [movement, setMovement] = useState<TemaMovement>("idle");
  const [moment, setMoment] = useState<TemaMoment>(null);
  const [voiceDraft, setVoiceDraft] = useState("");
  const [welcoming, setWelcoming] = useState(() => !sessionStorage.getItem(WELCOME_KEY));
  const x = useMotionValue(position.x);
  const y = useMotionValue(position.y);
  const reducedMotion = useReducedMotion();
  const pointerX = useMotionValue(0);
  const lean = useSpring(useTransform(pointerX, [-80, 80], [-3, 3]), { damping: 18, stiffness: 180 });
  const offset = useRef<Point>({ x: TEMA_WIDTH / 2, y: TEMA_HEIGHT / 2 });
  const horizontal = useRef<ReturnType<typeof animate> | null>(null);
  const vertical = useRef<ReturnType<typeof animate> | null>(null);
  const momentTimer = useRef<number | undefined>(undefined);
  const momentStartedAt = useRef(0);
  const workBaseY = useRef<number | null>(null);
  const voice = useHoneyVoice((transcript) => { setVoiceDraft(transcript); setChatOpen(true); });
  const activityMotion = MOTION[activity];
  const momentMotion = moment ? MOMENTS[moment] : null;
  const sprite = climbing ? { frames: 5, row: 4, speed: 135 } : welcoming ? { frames: 4, row: 3, speed: 230 } : momentMotion ?? (movement === "walking-left" ? { frames: 8, row: 2, speed: 130 } : movement === "walking-right" ? { frames: 8, row: 1, speed: 130 } : activityMotion);

  useEffect(() => subscribeToTemaActivity((next) => { if (next !== "idle") clearMoment(); setActivity(next); setFrame(0); }), []);
  useEffect(() => () => window.clearTimeout(momentTimer.current), []);
  useEffect(() => {
    if (!welcoming) return;
    sessionStorage.setItem(WELCOME_KEY, "1");
    const timer = window.setTimeout(() => setWelcoming(false), 7_000);
    return () => window.clearTimeout(timer);
  }, [welcoming]);
  useEffect(() => {
    if (activity === "running") {
      stopMotion(); setMovement("idle"); setClimbing(true); workBaseY.current = y.get();
      const target = Math.max(16, y.get() - 42);
      vertical.current = animate(y, target, { duration: 0.65, ease: "easeInOut", onComplete: () => setClimbing(false) });
      return;
    }
    if (workBaseY.current !== null && activity !== "waiting") {
      const target = workBaseY.current; workBaseY.current = null;
      vertical.current = animate(y, target, { duration: 0.45, ease: "easeOut", onComplete: () => place({ x: x.get(), y: target }) });
    }
  }, [activity, x, y]);
  useEffect(() => {
    setFrame(0);
    const timer = window.setInterval(() => setFrame((value) => (value + 1) % sprite.frames), sprite.speed);
    return () => window.clearInterval(timer);
  }, [sprite.frames, sprite.speed]);
  useEffect(() => {
    const keepOnScreen = () => place(clampTemaPosition({ x: x.get(), y: y.get() }));
    window.addEventListener("resize", keepOnScreen);
    return () => window.removeEventListener("resize", keepOnScreen);
  }, [x, y]);
  useEffect(() => {
    if (behavior !== "roam" || activity !== "idle" || movement !== "idle" || chatOpen || reducedMotion) return;
    const timer = window.setTimeout(() => walk(nextRoamingPosition(position)), 5000 + Math.random() * 4500);
    return () => window.clearTimeout(timer);
  }, [activity, behavior, chatOpen, movement, position, reducedMotion]);
  useEffect(() => {
    if (activity !== "idle" || movement !== "idle" || moment || welcoming || chatOpen || voice.listening || reducedMotion) return;
    const timer = window.setTimeout(() => playMoment(randomMoment()), 9_000 + Math.random() * 7_000);
    return () => window.clearTimeout(timer);
  }, [activity, chatOpen, moment, movement, reducedMotion, voice.listening, welcoming]);

  function startDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("button")) return;
    event.currentTarget.setPointerCapture(event.pointerId); stopMotion();
    offset.current = { x: event.clientX - x.get(), y: event.clientY - y.get() }; pointerX.set(0);
    setMovement("idle");
  }

  function move(event: ReactPointerEvent<HTMLDivElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const next = clampTemaPosition({ x: event.clientX - offset.current.x, y: event.clientY - offset.current.y }); pointerX.set(event.movementX * 4); x.set(next.x); y.set(next.y);
  }

  function endDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    event.currentTarget.releasePointerCapture(event.pointerId); pointerX.set(0); settle({ x: x.get(), y: y.get() });
  }

  function place(next: TemaPosition) { const safe = clampTemaPosition(next); x.set(safe.x); y.set(safe.y); setPosition(safe); savePosition(safe); setMovement("idle"); }
  function settle(next: TemaPosition) { const safe = clampTemaPosition(next); animate(x, safe.x, { damping: 24, stiffness: 320, type: "spring" }); animate(y, safe.y, { damping: 24, stiffness: 320, type: "spring", onComplete: () => place(safe) }); }
  function stopMotion() { horizontal.current?.stop(); vertical.current?.stop(); }
  function walk(target: TemaPosition) { const next = clampTemaPosition(target); const current = { x: x.get(), y: y.get() }; stopMotion(); setMovement(movementFor(current, next)); const duration = travelDuration(current, next); horizontal.current = animate(x, next.x, { duration, ease: "linear", onComplete: () => place(next) }); vertical.current = animate(y, next.y, { duration, ease: "linear" }); }
  function playMoment(next: Exclude<TemaMoment, null>) {
    if (Date.now() - momentStartedAt.current < 300) return;
    stopMotion(); clearMoment(); setWelcoming(false); setClimbing(false); setMovement("idle"); setFrame(0); setMoment(next);
    momentStartedAt.current = Date.now();
    momentTimer.current = window.setTimeout(() => { setMoment(null); momentStartedAt.current = 0; }, next === "work" ? 5_500 : 2_500);
  }
  function clearMoment() { window.clearTimeout(momentTimer.current); momentTimer.current = undefined; momentStartedAt.current = 0; setMoment(null); }
  function moveByKey(event: KeyboardEvent<HTMLDivElement>) { const moves: Record<string, Point> = { ArrowDown: { x: 0, y: 12 }, ArrowLeft: { x: -12, y: 0 }, ArrowRight: { x: 12, y: 0 }, ArrowUp: { x: 0, y: -12 } }; const delta = moves[event.key]; if (!delta) return; event.preventDefault(); place({ x: position.x + delta.x, y: position.y + delta.y }); }

  return <motion.div
    aria-label="TEMA screen companion. Drag to reposition, or use the arrow keys."
    className="group fixed left-0 top-0 z-50 cursor-grab touch-none select-none rounded-2xl outline-none active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-violet-400"
    data-tema-activity={activity} data-tema-behavior={behavior} data-tema-moment={moment ?? "none"} data-tema-movement={movement} data-testid="tema-mascot"
    onKeyDown={moveByKey}
    onPointerCancel={endDrag}
    onPointerDown={startDrag}
    onPointerMove={move}
    onPointerUp={endDrag}
    role="img" style={{ x, y }} tabIndex={0}
    title="Hi, I’m TEMA. Drag me anywhere on the screen."
  >
    {chatOpen ? <TemaQuickChat initialMessage={voiceDraft} onClose={() => { setChatOpen(false); setVoiceDraft(""); }} onOpen={onOpen} /> : null}
    {!chatOpen ? <span aria-live="polite" className={`pointer-events-none absolute bottom-full left-1/2 mb-3 w-52 -translate-x-1/2 rounded-3xl border border-violet-200/70 bg-background/95 px-4 py-3 text-sm shadow-lg backdrop-blur transition ${activity === "idle" && !welcoming && !voice.listening && !moment ? "scale-95 opacity-0 group-hover:scale-100 group-hover:opacity-100 group-focus-visible:scale-100 group-focus-visible:opacity-100" : "scale-100 opacity-100"}`}><strong className="block">Hi, I’m TEMA</strong><span className="text-muted-foreground">{voice.listening ? voice.preview || "I’m listening…" : welcoming ? "Welcome back. I’m ready to help with today’s work." : climbing ? "Getting into position…" : momentMotion?.label ?? activityMotion.label}</span></span> : null}
    <motion.span animate={spriteBodyMotion(movement, moment, climbing, activity, Boolean(reducedMotion))} aria-hidden="true" className="pointer-events-none block origin-bottom drop-shadow-[0_12px_14px_rgba(50,20,80,0.3)]" style={{
      backgroundImage: "url('/pets/tema/spritesheet.webp')",
      backgroundPosition: `${-frame * TEMA_WIDTH}px ${-sprite.row * TEMA_HEIGHT}px`,
      backgroundRepeat: "no-repeat",
      backgroundSize: `${FRAME_WIDTH * 8 * SCALE}px ${FRAME_HEIGHT * 11 * SCALE}px`,
      height: TEMA_HEIGHT, rotate: lean,
      width: TEMA_WIDTH
    }} transition={spriteBodyTransition(movement, moment, climbing)} />
    <button aria-label={voice.listening ? "Stop TEMA voice assistance" : "Start TEMA voice assistance"} className={`absolute left-1/2 top-[calc(100%-0.2rem)] grid size-8 -translate-x-1/2 place-items-center rounded-full border bg-background/95 text-violet-700 shadow-md transition ${voice.listening ? "pointer-events-auto scale-100 opacity-100" : "pointer-events-none scale-90 opacity-0 group-hover:pointer-events-auto group-hover:scale-100 group-hover:opacity-100 group-focus-visible:pointer-events-auto group-focus-visible:opacity-100"}`} disabled={!voice.supported} onClick={(event) => { event.stopPropagation(); voice.toggle(); }} onPointerDown={(event) => event.stopPropagation()} title={voice.supported ? "Speak to TEMA" : "Voice assistance needs Chrome or Edge"} type="button"><AudioWaveformIcon className={`size-4 ${voice.listening ? "animate-pulse" : ""}`} /></button>
    <DropdownMenu><DropdownMenuTrigger asChild><button aria-label="TEMA options" className="pointer-events-none absolute left-[calc(100%-0.25rem)] top-1/2 grid size-8 -translate-y-1/2 scale-90 place-items-center rounded-full border bg-background/95 text-violet-700 opacity-0 shadow-md transition group-hover:pointer-events-auto group-hover:scale-100 group-hover:opacity-100 group-focus-visible:pointer-events-auto group-focus-visible:opacity-100" onPointerDown={(event) => event.stopPropagation()} type="button"><EllipsisVerticalIcon className="size-4" /></button></DropdownMenuTrigger><DropdownMenuContent align="start" className="w-52 rounded-2xl" side="right" sideOffset={8}><DropdownMenuLabel>TEMA movement</DropdownMenuLabel><MovementChoice active={behavior === "stay"} icon={<PauseIcon />} label="Stay in place" onSelect={() => changeBehavior("stay")} /><MovementChoice active={behavior === "roam"} icon={<MoveHorizontalIcon />} label="Roam left and right" onSelect={() => changeBehavior("roam")} /><DropdownMenuLabel>TEMA actions</DropdownMenuLabel><DropdownMenuItem onPointerDown={() => playMoment("jump")} onSelect={() => playMoment("jump")}><SparklesIcon />Jump</DropdownMenuItem><DropdownMenuItem onPointerDown={() => playMoment("wave")} onSelect={() => playMoment("wave")}><HandIcon />Wave hello</DropdownMenuItem><DropdownMenuItem onPointerDown={() => playMoment("work")} onSelect={() => playMoment("work")}><LaptopIcon />Work on laptop</DropdownMenuItem><DropdownMenuLabel>TEMA assistant</DropdownMenuLabel><DropdownMenuItem onSelect={() => setChatOpen(true)}><MessageCircleIcon />Quick chat</DropdownMenuItem><DropdownMenuItem onSelect={onOpen}><MessageCircleIcon />Open full chat</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
  </motion.div>;

  function changeBehavior(next: "roam" | "stay") {
    stopMotion();
    place({ x: x.get(), y: y.get() });
    setBehavior(next);
    localStorage.setItem(BEHAVIOR_KEY, next);
  }
}

function loadPosition(): Point {
  const fallback = defaultPosition();
  try {
    const value = JSON.parse(localStorage.getItem(POSITION_KEY) ?? "null") as Point | null;
    return value && Number.isFinite(value.x) && Number.isFinite(value.y) ? clampTemaPosition(value) : fallback;
  } catch {
    return fallback;
  }
}

function savePosition(position: Point): void {
  try { localStorage.setItem(POSITION_KEY, JSON.stringify(position)); } catch {}
}

function defaultPosition(): Point { return homePosition(); }

function randomMoment(): Exclude<TemaMoment, null> {
  const moments: Array<Exclude<TemaMoment, null>> = ["jump", "wave", "work"];
  return moments[Math.floor(Math.random() * moments.length)] ?? "wave";
}

function MovementChoice({ active, icon, label, onSelect }: { active: boolean; icon: ReactNode; label: string; onSelect: () => void }) {
  return <DropdownMenuItem aria-checked={active} className={active ? "bg-violet-50 text-violet-950" : ""} onPointerDown={(event) => { event.stopPropagation(); onSelect(); }} onSelect={onSelect} role="menuitemradio">{icon}<span className="flex-1">{label}</span>{active ? <CheckIcon aria-hidden="true" className="text-violet-700" /> : <span aria-hidden="true" className="size-4" />}</DropdownMenuItem>;
}

function spriteBodyMotion(movement: TemaMovement, moment: TemaMoment, climbing: boolean, activity: TemaActivity, reduced: boolean) {
  if (reduced) return { scale: 1, y: 0 };
  if (climbing || moment === "jump") return { scale: [1, 0.97, 1.03, 1], y: [0, 4, -9, 0] };
  if (movement !== "idle") return { scaleY: [1, 0.975, 1], y: [0, -2, 0] };
  if (moment === "work" || activity === "running") return { scale: [1, 1.012, 1], y: [0, -1, 0] };
  return { scale: [1, 1.008, 1], y: [0, -1.5, 0] };
}

function spriteBodyTransition(movement: TemaMovement, moment: TemaMoment, climbing: boolean) {
  if (climbing || moment === "jump") return { duration: 0.7, ease: "easeInOut" as const };
  if (movement !== "idle") return { duration: 0.52, ease: "linear" as const, repeat: Infinity };
  return { duration: moment === "work" ? 1.1 : 2.8, ease: "easeInOut" as const, repeat: Infinity };
}
