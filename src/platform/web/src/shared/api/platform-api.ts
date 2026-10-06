import { requiredClientEnv } from "../env/client-env";
import { beginTemaJob, finishTemaJob } from "../tema-activity";
import { currentSessionStore } from "../auth/session-store";

const apiBaseUrl = requiredClientEnv("VITE_PLATFORM_API_URL");
const SESSION_EXPIRED_WARNING_KEY = "techmedia_session_expired_warning";

export type Desk = "app";
type ApiEnvelope<T> = { data: T; success: true } | { error: { message: string }; success: false };

export function getToken(): string | null {
  return currentSessionStore().get();
}

export function setToken(token: string): void {
  void currentSessionStore()
    .set(token)
    .catch(() => {});
}

export function clearToken(): void {
  void currentSessionStore()
    .clear()
    .catch(() => {});
}

export function clearBrowserSession(): void {
  clearToken();
  try {
    sessionStorage.clear();
    localStorage.removeItem(SESSION_EXPIRED_WARNING_KEY);
  } catch {}
}

export function tokenIsCurrent(token = getToken()): boolean {
  const expiresAt = tokenExpiresAt(token);
  return expiresAt !== null && expiresAt > Date.now();
}

export function tokenExpiresAt(token = getToken()): number | null {
  if (!token) return null;
  try {
    const encoded = token.split(".")[1];
    if (!encoded) return null;
    const claims = JSON.parse(atob(encoded.replace(/-/g, "+").replace(/_/g, "/"))) as {
      exp?: number;
    };
    return typeof claims.exp === "number" ? claims.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function redirectToLoginForExpiredSession(): void {
  clearToken();
  try {
    sessionStorage.setItem(SESSION_EXPIRED_WARNING_KEY, "1");
  } catch {}
  window.location.replace("/login");
}

export function hasSessionExpiredWarning(): boolean {
  try {
    return sessionStorage.getItem(SESSION_EXPIRED_WARNING_KEY) === "1";
  } catch {
    return false;
  }
}

export function clearSessionExpiredWarning(): void {
  try {
    sessionStorage.removeItem(SESSION_EXPIRED_WARNING_KEY);
  } catch {}
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const tracksJob =
    options.method !== undefined && options.method !== "GET" && !isCredentialRequest(path);
  if (tracksJob) beginTemaJob();
  const token = getToken();
  try {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      ...options,
      headers: {
        ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers
      }
    });
    const responseText = await response.text();
    let envelope: ApiEnvelope<T> | null = null;
    if (responseText) {
      try {
        envelope = JSON.parse(responseText) as ApiEnvelope<T>;
      } catch {
        throw new Error(`CRM API returned an invalid response (${response.status}).`);
      }
    }
    if (!envelope) throw new Error("CRM API returned an empty response.");
    if (!response.ok || !envelope.success) {
      if (response.status === 401 && token && !isCredentialRequest(path)) {
        redirectToLoginForExpiredSession();
      }
      throw new Error(envelope.success ? "Request failed" : envelope.error.message);
    }
    if (tracksJob) finishTemaJob(true);
    return envelope.data;
  } catch (error) {
    if (tracksJob) finishTemaJob(false);
    throw error;
  }
}

function isCredentialRequest(path: string) {
  return path === "/auth/login" || path === "/auth/development/login";
}

export function apiGet<T>(path: string, ..._unused: unknown[]): Promise<T> {
  return request<T>(path, { method: "GET" });
}

export function apiPost<T>(path: string, data?: unknown, ..._unused: unknown[]): Promise<T> {
  return request<T>(path, { body: JSON.stringify(data ?? {}), method: "POST" });
}

export function apiPut<T>(path: string, data?: unknown, ..._unused: unknown[]): Promise<T> {
  return request<T>(path, { body: JSON.stringify(data ?? {}), method: "PUT" });
}

export function apiDelete<T>(path: string, ..._unused: unknown[]): Promise<T> {
  return request<T>(path, { method: "DELETE" });
}

export async function login(input: { email: string; password: string }) {
  clearToken();
  try {
    const data = await apiPost<{
      accessToken: string;
      email: string;
      name: string;
      permissions: string[];
      role: string;
    }>("/auth/login", input);
    setToken(data.accessToken);
    return { data, success: true } as const;
  } catch (error) {
    return {
      error: { message: error instanceof Error ? error.message : "Login failed" },
      success: false
    } as const;
  }
}

export async function developmentLogin() {
  clearToken();
  try {
    const data = await apiPost<{ accessToken: string; role?: string }>("/auth/development/login");
    setToken(data.accessToken);
    return { data, success: true } as const;
  } catch (error) {
    return {
      error: { message: error instanceof Error ? error.message : "Development login failed" },
      success: false
    } as const;
  }
}

export async function logout(): Promise<void> {
  try {
    if (getToken()) await apiPost("/auth/logout");
  } catch {}
  clearToken();
}

export async function resetBrowserSession(): Promise<void> {
  try {
    await logout();
  } finally {
    clearBrowserSession();
    await clearBrowserCache();
  }
}

async function clearBrowserCache(): Promise<void> {
  if (!("caches" in window)) return;
  await Promise.all((await window.caches.keys()).map((key) => window.caches.delete(key)));
}
