export type TemaActivity = "failed" | "idle" | "review" | "running" | "waiting";

const ACTIVITY_EVENT = "techmedia:tema-activity";
const WAITING_DELAY_MS = 2_500;
let activeJobs = 0;
let waitingTimer: number | undefined;
let resetTimer: number | undefined;

export function beginTemaJob(): void {
  activeJobs += 1;
  clearTimers();
  publish("running");
  waitingTimer = window.setTimeout(() => publish("waiting"), WAITING_DELAY_MS);
}

export function finishTemaJob(succeeded: boolean): void {
  activeJobs = Math.max(0, activeJobs - 1);
  if (activeJobs > 0) return;
  clearTimers();
  publish(succeeded ? "review" : "failed");
  resetTimer = window.setTimeout(() => publish("idle"), succeeded ? 1_800 : 3_200);
}

export function subscribeToTemaActivity(listener: (activity: TemaActivity) => void): () => void {
  const receive = (event: Event) => listener((event as CustomEvent<TemaActivity>).detail);
  window.addEventListener(ACTIVITY_EVENT, receive);
  return () => window.removeEventListener(ACTIVITY_EVENT, receive);
}

function publish(activity: TemaActivity): void {
  window.dispatchEvent(new CustomEvent(ACTIVITY_EVENT, { detail: activity }));
}

function clearTimers(): void {
  window.clearTimeout(waitingTimer);
  window.clearTimeout(resetTimer);
}
