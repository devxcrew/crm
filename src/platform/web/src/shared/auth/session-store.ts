export interface SessionStore {
  clear(): Promise<void>;
  get(): string | null;
  hydrate(): Promise<void>;
  set(token: string): Promise<void>;
}

const TOKEN_KEY = "techmedia_session";

class BrowserSessionStore implements SessionStore {
  async clear() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {}
  }

  get() {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  }

  async hydrate() {}

  async set(token: string) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {}
  }
}

let sessionStore: SessionStore = new BrowserSessionStore();

export function configureSessionStore(store: SessionStore) {
  sessionStore = store;
}

export function currentSessionStore() {
  return sessionStore;
}
