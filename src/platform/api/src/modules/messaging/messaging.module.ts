import { defineModule } from "@codexsun/framework/modules";
import { getTechMediaDatabase } from "../../database/techmedia-database.js";
import { verifyAuthToken } from "../../auth/jwt.js";
import { env } from "../../env.js";
import type { PlatformModuleDependencies } from "../../module-dependencies.js";
import { ConnectionManager } from "./connection-manager.js";
import { KyselyMessagingRepository } from "./messaging.repositories.js";
import { registerMessagingRoutes } from "./messaging.routes.js";
import { InMemoryRealtimeBus } from "./realtime-bus.js";
import { RealtimeGateway } from "./realtime-gateway.js";
import { registerMessagingWebSocket } from "./ws-adapter.js";
import { LocalMessageMediaStorage } from "./message-media-storage.js";
import type { MessagingActor } from "./messaging.types.js";

export const messagingModule = defineModule<PlatformModuleDependencies>({
  key: "messaging",
  label: "Business Messaging",
  register: async ({ app, notificationPublisher }) => {
    const database = getTechMediaDatabase();
    const repository = new KyselyMessagingRepository(database);
    const media = new LocalMessageMediaStorage(
      env.MESSAGE_MEDIA_STORAGE_ROOT,
      env.MESSAGE_MEDIA_MAX_UPLOAD_BYTES
    );
    const manager = new ConnectionManager();
    const bus = new InMemoryRealtimeBus(manager);
    const gateway = new RealtimeGateway({
      actorFromToken: async (token): Promise<MessagingActor | undefined> => {
        const claims = verifyAuthToken(token);
        if (!claims) return undefined;
        const user = await database
          .selectFrom("users")
          .select(["email", "id", "name", "uuid"])
          .where("uuid", "=", claims.userId)
          .where("status", "=", "active")
          .executeTakeFirst();
        return user
          ? { email: user.email, id: user.id, name: user.name, uuid: user.uuid }
          : undefined;
      },
      bus,
      manager,
      media,
      repository
    });
    await registerMessagingWebSocket(app, { gateway, manager });
    registerMessagingRoutes(app, repository, bus, media, notificationPublisher);
  }
});
