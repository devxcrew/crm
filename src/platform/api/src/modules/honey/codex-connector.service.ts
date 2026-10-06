import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";
import { createRequire } from "node:module";
import { secureCodexCredentials } from "./codex-credentials.js";

type Pending = { reject: (error: Error) => void; resolve: (value: unknown) => void };

class CodexConnectorService {
  private process: ChildProcessWithoutNullStreams | null = null;
  private pending = new Map<number, Pending>();
  private id = 1;

  async status() {
    try {
      const result = (await this.request("account/read", { refreshToken: false })) as {
        account?: { email?: string; planType?: string; type?: string } | null;
      };
      return {
        available: true,
        connected: Boolean(result.account),
        email: result.account?.email ?? null,
        planType: result.account?.planType ?? null,
        accountType: result.account?.type ?? null,
        error: null
      };
    } catch (error) {
      return {
        available: false,
        connected: false,
        email: null,
        planType: null,
        accountType: null,
        error: error instanceof Error ? error.message : "Codex is unavailable."
      };
    }
  }

  deviceLogin() {
    return this.request("account/login/start", { type: "chatgptDeviceCode" });
  }
  browserLogin() {
    return this.request("account/login/start", {
      type: "chatgpt",
      useHostedLoginSuccessPage: true,
      appBrand: "chatgpt"
    });
  }
  cancel(loginId: string) {
    return this.request("account/login/cancel", { loginId });
  }
  logout() {
    return this.request("account/logout", {});
  }

  private async request(method: string, params: unknown) {
    await secureCodexCredentials();
    await this.start();
    const id = this.id++;
    const result = new Promise<unknown>((resolve, reject) => {
      this.pending.set(id, { reject, resolve });
      setTimeout(() => {
        if (this.pending.delete(id)) reject(new Error(`Codex request timed out: ${method}`));
      }, 20_000).unref();
    });
    this.process!.stdin.write(`${JSON.stringify({ id, method, params })}\n`);
    return result.finally(secureCodexCredentials);
  }

  private async start() {
    if (this.process && !this.process.killed) return;
    const configured = process.env.CODEX_EXECUTABLE?.trim();
    const script =
      configured || createRequire(import.meta.url).resolve("@openai/codex/bin/codex.js");
    const child = spawn(
      configured ? script : process.execPath,
      configured ? ["app-server"] : [script, "app-server"],
      {
        cwd: process.cwd(),
        env: process.env,
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true
      }
    );
    this.process = child;
    createInterface({ input: child.stdout }).on("line", (line) => this.handle(line));
    child.on("exit", () => this.fail("Codex App Server stopped."));
    child.on("error", (error) => this.fail(error.message));
    await new Promise<void>((resolve, reject) => {
      child.once("spawn", resolve);
      child.once("error", reject);
    });
    const initialized = this.request("initialize", {
      clientInfo: { name: "techmedia_tema", title: "CRM TEMA", version: "1.0.28" }
    });
    await initialized;
    child.stdin.write(`${JSON.stringify({ method: "initialized", params: {} })}\n`);
  }

  private handle(line: string) {
    let message: { error?: { message?: string }; id?: number; method?: string; result?: unknown };
    try {
      message = JSON.parse(line) as typeof message;
    } catch {
      return;
    }
    if (message.method && typeof message.id === "number") {
      this.process?.stdin.write(
        `${JSON.stringify({ id: message.id, result: { decision: "decline" } })}\n`
      );
      return;
    }
    if (typeof message.id !== "number") return;
    const pending = this.pending.get(message.id);
    if (!pending) return;
    this.pending.delete(message.id);
    if (message.error) pending.reject(new Error(message.error.message ?? "Codex request failed."));
    else pending.resolve(message.result);
  }

  private fail(message: string) {
    this.process = null;
    for (const item of this.pending.values()) item.reject(new Error(message));
    this.pending.clear();
  }
}

export const codexConnector = new CodexConnectorService();
