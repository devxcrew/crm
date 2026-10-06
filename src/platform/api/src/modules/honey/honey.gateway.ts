import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { AppError } from "@codexsun/framework/errors";
import { env } from "../../env.js";
import { secureCodexCredentials } from "./codex-credentials.js";

type Message = { content: string; role: "assistant" | "system" | "user" };
type ProviderLog = {
  error: (details: Record<string, unknown>, message: string) => void;
};

export class HoneyModelGateway {
  constructor(
    private readonly telemetry?: {
      logger: ProviderLog;
      requestId: string;
    }
  ) {}

  async complete(messages: Message[]) {
    const provider = env.AI_API_KEY ? env.AI_PROVIDER : "codex";
    try {
      return env.AI_API_KEY
        ? await this.completeWithProvider(messages, provider)
        : await completeWithCodex(messages);
    } catch (error) {
      if (error instanceof AppError) throw error;
      this.logFailure(provider, null, null, "Provider request failed.");
      throw providerUnavailable();
    }
  }

  private async completeWithProvider(messages: Message[], provider: string) {
    const response = await fetch(`${env.AI_BASE_URL.replace(/\/$/u, "")}/chat/completions`, {
      body: JSON.stringify({ messages, model: env.AI_MODEL, temperature: 0.35 }),
      headers: {
        Authorization: `Bearer ${env.AI_API_KEY}`,
        "Content-Type": "application/json",
        ...providerHeaders()
      },
      method: "POST",
      signal: AbortSignal.timeout(env.AI_TIMEOUT_MS)
    });
    const providerRequestId = response.headers.get("x-request-id");
    if (!response.ok) {
      this.logFailure(provider, response.status, providerRequestId, "Provider request failed.");
      throw providerUnavailable();
    }

    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      this.logFailure(provider, response.status, providerRequestId, "Provider returned no content.");
      throw providerUnavailable();
    }
    return content;
  }

  private logFailure(
    provider: string,
    httpStatus: number | null,
    providerRequestId: string | null,
    message: string
  ) {
    this.telemetry?.logger.error(
      {
        httpStatus,
        message,
        provider,
        providerRequestId,
        requestId: this.telemetry.requestId
      },
      "TEMA provider request failed"
    );
  }
}

async function completeWithCodex(messages: Message[]) {
  await secureCodexCredentials();
  const script = createRequire(import.meta.url).resolve("@openai/codex/bin/codex.js");
  const prompt = messages
    .map((message) => `${message.role.toUpperCase()}:\n${message.content}`)
    .join("\n\n");
  try {
    const stdout = await runCodex(script, prompt);
    const content = stdout.trim();
    if (!content) throw new Error("Connected Codex account returned an empty response.");
    return content;
  } finally {
    await secureCodexCredentials();
  }
}

function runCodex(script: string, prompt: string) {
  return new Promise<string>((resolve, reject) => {
    const child = execFile(
      process.execPath,
      [
        script,
        "exec",
        "--ephemeral",
        "--sandbox",
        "read-only",
        "--skip-git-repo-check",
        "--color",
        "never",
        "-"
      ],
      { cwd: process.cwd(), maxBuffer: 2_000_000, timeout: env.AI_TIMEOUT_MS },
      (error, stdout) =>
        error
          ? reject(new Error("Codex process exited without generating a response."))
          : resolve(stdout)
    );
    child.stdin?.end(prompt);
  });
}

function providerHeaders() {
  return env.AI_PROVIDER === "openrouter"
    ? { "HTTP-Referer": env.PLATFORM_WEB_ORIGIN, "X-Title": "CRM Honey" }
    : {};
}

function providerUnavailable() {
  return new AppError({
    code: "AI_PROVIDER_UNAVAILABLE",
    message: "TEMA could not generate a response. Please try again later.",
    statusCode: 502
  });
}
