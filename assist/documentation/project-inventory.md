# Project Inventory

## Applications

- `src/platform/api`: Fastify API and composition root.
- `src/platform/web`: React application with one login and one desk.
- `apps/techmedia_flutter`: the only mobile client. It owns the Flutter Android application and
  communicates through the CRM HTTP and WebSocket API contracts.

## API Modules

- `user`
- `role`
- `permission`
- `user-role`
- `role-permission`
- `branding`
- `frappe`
- `notification`
- `crm`
- `hr`
- `estimate`
- `quotation`
- `ishop`
- `honey`
- `messaging`

Honey includes the system-administrator global availability control for TEMA chat and mascot
surfaces, plus separate web and mobile pet visibility controls. The shared responsive side menu
contains the current device's personal pet toggle.

## Shared Dependencies

- `packages/framework`: repository-owned backend infrastructure and public module contracts.
- `packages/ui`: repository-owned React components, layouts, and workspace primitives.

No parent-folder or sibling product repository is part of the CRM install, build, or runtime.

## Web Documentation

- `src/platform/web/src/modules/docs`: authenticated documentation index and article renderer.
- `src/platform/web/src/modules/docs/content`: repository-owned MDX guides compiled during the web build.
- `assist/documentation/CHANGELOG.md`: the single changelog source rendered directly in Docs.

## Generated Layout

- `node_modules`: the only dependency installation directory.
- `dist/packages/framework`: compiled Framework runtime.
- `dist/platform/api`: compiled API runtime.
- `dist/platform/web`: production web bundle.
- `apps/techmedia_flutter/build`: generated Flutter application output.

Workspace-local `node_modules`, `dist`, and `dist-types` directories are prohibited.
