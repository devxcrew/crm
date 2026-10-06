import { defineModule } from "@codexsun/framework/modules";
import type { PlatformModuleDependencies } from "../../module-dependencies.js";
import { registerIshopRoutes } from "./ishop.routes.js";
export const ishopModule = defineModule<PlatformModuleDependencies>({ key: "ishop", label: "LogicX iShop", register: ({ app }) => registerIshopRoutes(app) });
