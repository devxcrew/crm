import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

export type PushMessage = {
  body: string;
  data: Record<string, string>;
  title: string;
};

export type PushDeliveryResult = {
  invalidTokens: string[];
  sent: number;
};

export class FirebasePushGateway {
  private constructor(private readonly app: App | null) {}

  static fromServiceAccountJson(value: string): FirebasePushGateway {
    const source = value.trim();
    if (!source) return new FirebasePushGateway(null);

    const credentials = parseServiceAccount(source);
    const app =
      getApps().find((candidate) => candidate.name === "techmedia-fcm") ??
      initializeApp(
        {
          credential: cert({
            clientEmail: credentials.client_email,
            privateKey: credentials.private_key,
            projectId: credentials.project_id
          })
        },
        "techmedia-fcm"
      );
    return new FirebasePushGateway(app);
  }

  get isConfigured() {
    return this.app !== null;
  }

  async send(tokens: string[], message: PushMessage): Promise<PushDeliveryResult> {
    if (!this.app || !tokens.length) return { invalidTokens: [], sent: 0 };

    const invalidTokens: string[] = [];
    let sent = 0;
    for (const group of chunks(tokens, 500)) {
      const result = await getMessaging(this.app).sendEachForMulticast({
        android: {
          notification: { channelId: "techmedia_activity" },
          priority: "high"
        },
        data: message.data,
        notification: { body: message.body, title: message.title },
        tokens: group
      });
      sent += result.successCount;
      result.responses.forEach((response, index) => {
        if (response.success || !isInvalidTokenError(response.error?.code)) return;
        const token = group[index];
        if (token) invalidTokens.push(token);
      });
    }
    return { invalidTokens, sent };
  }
}

function parseServiceAccount(value: string) {
  const parsed: unknown = JSON.parse(value);
  if (!isServiceAccount(parsed)) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not a Firebase service account.");
  }
  return parsed;
}

function isServiceAccount(
  value: unknown
): value is { client_email: string; private_key: string; project_id: string } {
  if (!value || typeof value !== "object") return false;
  const account = value as Record<string, unknown>;
  return ["client_email", "private_key", "project_id"].every(
    (key) => typeof account[key] === "string" && Boolean(account[key])
  );
}

function isInvalidTokenError(code: string | undefined) {
  return (
    code === "messaging/registration-token-not-registered" ||
    code === "messaging/invalid-registration-token"
  );
}

function chunks<T>(values: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size)
    result.push(values.slice(index, index + size));
  return result;
}
