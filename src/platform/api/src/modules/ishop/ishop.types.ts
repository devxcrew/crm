import type { Kysely } from "kysely";
import type { TechMediaDatabase } from "../../database/schema.js";
export type IshopContext = { actorUser: () => Promise<{ id: number } | undefined>; authorize: (permission: string) => Promise<void>; database: Kysely<TechMediaDatabase> };
