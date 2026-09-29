# CLAUDE.md

Guidance for Claude Code (claude.ai/code) when working in this repository.

## Project Overview

**PretzelGraph** is a visual agent runtime. Users compose plain workflows, agentic workflows, and multi-agent topologies on a node-graph canvas; the system compiles those graphs and executes them on a signal-based engine (S²Engine) where cycles are first-class, so agents can loop, hand off, and re-fire.

## Running Locally

Stateful services run in Docker; the packages run on the host.

```bash
docker compose up -d        # postgres, redis, gotrue (auth)
cp .env.example .env        # values match the compose defaults
npm install
npm run dev                 # backend :3001, worker, frontend :5173, nodes index watcher
```

The backend migrates its own database on boot (`packages/backend/migrations/`). The first account to sign up owns the deployment. `docker compose --profile full up -d` runs everything in containers on port 8080. See `README.md` for details.

## Development Commands

| Package | Command | What it does |
|---|---|---|
| root | `npm run dev` | Backend, worker, frontend, and nodes index watcher together |
| root | `npm run build` | Build every workspace |
| `frontend` | `npm run dev` / `build` / `lint` / `preview` | Vite dev server / `tsc -b` + bundle / ESLint / preview |
| `backend` | `npm run dev` / `build` / `start` | nodemon + ts-node / compile + copy migrations and assets / run `dist` |
| `worker` | `npm run dev` / `build` / `test` | `tsx watch` / compile / Node test runner over `src/**/*.test.ts` |
| `webhook` | `npm run dev` / `build` / `start` | Standalone inbound webhook receiver on port 3002 |
| `nodes` | `npm run generate-indexes` | Rebuild the blueprint catalog (`packages/backend/assets/blueprint_index.json`, gitignored) |
| `nodes` | `npm run test` / `typecheck` | Node tests / `tsc --noEmit` |
| `node-sdk` | `npm run typecheck` | `tsc --noEmit` |

`shared` and `standard-ui` have no build step; they are consumed as workspace sources. The backend runs `generate-indexes` automatically in `predev` and `prebuild`.

## Architecture

### Monorepo Layout
```
packages/
  frontend/    # React 19 + Vite + XYFlow editor, TanStack Router + Query
  backend/     # NestJS API + WebSocket realtime + BullMQ producer; serves the built frontend
  worker/      # Execution engine: TurboGraph compiler + AggexEngine/S²Engine + airlock sandbox
  webhook/     # Standalone inbound webhook receiver (ignites published workflows)
  shared/      # Domain models (Zod schemas + branded IDs) used by every package
  standard-ui/ # UI kit: Radix + Tailwind foundations, icons, BaseSDK/SDKManager, Dialog/Notification/Query/System SDKs
  node-sdk/    # Node authoring SDK: RuntimeNode, builders, and execution-context API contracts
  nodes/       # Node implementations (blueprint.ts + node.ts) by provider
```

### Frontend State — SDK Pattern
All state lives in Zustand stores wrapped by typed SDK classes. `BaseSDK<T_State>` and `SDKManager` (the DI container) live in `packages/standard-ui/src/SDKs/`. Each SDK exposes:
- `useStore` — Zustand store (Immer; Zundo undo/redo where needed)
- `reducers` — Immer-based state mutations
- `actions` — Side-effectful operations (API calls, sockets)
- `selectors` — Computed/derived values

App-wide SDKs live in `packages/frontend/src/SDKs/` (Auth, Library, Vault, Realtime, Settings, VersionControl, Webhook, Activity, ApiInterceptor). Editor-scoped SDKs live in `src/routes/workflow/-SDKs/` (Workbench, Execution, Shelf, Drawer, Stack, Airlock, Assistant, Chat, Consultation). `WorkbenchSDK` owns the editor: nodes, edges, viewport, selection, clipboard, dirty flag.

### Routing
TanStack Router, file-based under `src/routes/`. Route groups: `auth/`, `home/` (library, executions, credentials, templates, settings, usage), `workflow/$workflowid`. `routeTree.gen.ts` is generated — never edit it.

### Domain Models (`packages/shared/domain/`)
Zod schemas with inferred types and branded string IDs (`Workflow.Id`, `Node.Id`, `Execution.Id`, …). Main namespaces:
- `Workflow` — nodes, edges, data, cache, dependencies, migrations, repair
- `Foundations` — Field, Port, Blueprint, Projection base types
- `Execution` — session, events, signals, igniter, recording, queue
- `Workbench` — editor document + operations (collaborative state sync)
- `Vault`, `Auth`, `VersionControl`, `Webhook`, `Airlock`, `Chat`, `Assistant`, `Consultation`, `Activity`, `Listing`, `Workspace`

### Execution Engine (`worker`) + Nodes (`nodes`, `node-sdk`)
**Full engine docs: `packages/worker/README.md`** (S² scheduling loop, signal vs data dependency, propagation strategies, error routing, sub-workflows).
- `turboGraph/` — `TurboGraph` compiler: builds the `S2Graph` + execution context, instantiates nodes, wires edges, exposes the tiered node-facing APIs
- `S2/` — `S2Engine`, a domain-agnostic signal scheduler driven by hooks
- `engine/` — `AggexEngine` implements those hooks and composes the engine services (session, node IO, routing, propagation, scheduler, errors, flight recorder). Nodes fire on accumulated signals and may re-fire; cycles are first-class
- `airlock/` — the `isolated-vm` sandbox user code runs in; one isolate per execution, shared by sub-workflows
- `worker.ts` — BullMQ consumer of `Execution.Queue`; `server.ts` — its HTTP surface
- Node implementations live in **`packages/nodes/src/`**, not the worker: `Core/` (Chat, LanguageModel, Routing, SubWorkflow, Text, Utils, Webhook, Workbench, Developer) and `Integrations/<Provider>/`. Each node is `blueprint.ts` + `node.ts`; conditional fields/ports are inline blueprint derivatives
- `packages/node-sdk/` — `RuntimeNode` base class, field/port/credential/blueprint builders, and execution-context API contracts
- The worker owns the Nest `CatalogueService` and live connection managers; RuntimeNodes reach them through `catalogueAPI` and `connectionAPI`

### Backend (`packages/backend`)
NestJS on port 3001 (`PORT`). Entry `src/main.ts`; `serve-frontend.ts` serves the built editor for any non-API path.
- **Data:** Kysely over `pg` (`src/db/`). Migrations are plain SQL in `migrations/`, applied on boot. No ORM, no PostgREST.
- **Auth:** GoTrue issues JWTs; guards in `src/auth/` cover members (`member-auth.guard`), API keys, delegated tokens, internal service calls, and per-execution tokens. `min-role.decorator` gates by role.
- **Controllers:** `library`, `workbench`, `shelf`, `execution`, `vault` (+ `vault/oauth`, `oauth`), `version-control`, `webhook`, `webhook-test`, `chat`, `consultation`, `activity`, `api-keys`, `auth`, `health`. `internal/*` routes are for the worker and webhook services, never the browser.
- **Realtime:** WebSocket gateway on `/socket` pushes execution and workbench events.
- **Queue:** BullMQ on Redis; the backend enqueues, the worker consumes.

### Styling
Tailwind CSS 4. Theme, colors, plugins, and animations live in `packages/standard-ui/src/tailwind-preset.ts` and `styles.css`; the frontend's `tailwind.config.ts` only lists content paths. Port types have dedicated CSS variables (`--port-message`, `--port-str`, …). Dark/light theme is class-based.

## Conventions

- **Dialogs/Confirmations**: Always use `DialogSDK.actions.push()` with `DialogSDK.Template` or `DialogSDK.AlertTemplate` to open dialogs. Do not use inline `AlertDialog.Root`/`Trigger`/`Content` patterns. See `VaultSDK/ui/VaultPanel.tsx` for examples.

- **Adding a new node**: See the full guide in **`packages/node-sdk/README.md`** (builders, ports, credentials, RuntimeNode hooks, ResourceLoader/derivatives, DB connection layer). In short: create `blueprint.ts` + `node.ts` (the class is resolved by blueprint-id → path convention, e.g. `Integrations.Postgres.Query` → `packages/nodes/src/Integrations/Postgres/Query/node.ts`); then (1) register the blueprint ID in the appropriate drawer in `packages/shared/constants/drawers.ts` (drawer key matches the provider, e.g. `tavily`, `postgres`); (2) if it has a credential, define it in `packages/nodes/src/Credentials/` and re-export from `Credentials/index.ts`; (3) run `npm run generate-indexes` (in `packages/nodes`) to refresh the catalog `packages/backend/assets/blueprint_index.json` (gitignored; also regenerated automatically by the backend's `predev`/`prebuild`). Operation-style nodes use inline blueprint derivatives — see `Integrations/Redis/Database` and `Integrations/MongoDB/Operation`.

- **Reading SDK state inside callbacks/handlers**: Never subscribe to SDK state via `useStore` just to use it inside an event handler or async function. Read it at call time from `SDK.state` directly inside the function. `useStore` subscriptions cause re-renders on every state change — only use them for values the component must re-render on. Example: inside a `fetchOptions` function, do `const value = WorkbenchSDK.state.data.someSlice[nodeId]`, not `const value = WorkbenchSDK.useStore(s => s.data.someSlice[nodeId])` at the component level.

- **Database access**: Go through Kysely and the helpers in `packages/backend/src/db/`. Schema changes are a new numbered SQL file in `packages/backend/migrations/`.

- **Comments**: One line, describing what the code does. No reasoning essays, no dated notes.

## Key File Locations

| Concern | Path |
|---|---|
| Editor state (Zustand) | `packages/frontend/src/routes/workflow/-SDKs/WorkbenchSDK/sdk.ts` |
| Editor reducers / actions | `packages/frontend/src/routes/workflow/-SDKs/WorkbenchSDK/reducers.ts`, `actions/` |
| Graph canvas | `packages/frontend/src/routes/workflow/-SDKs/WorkbenchSDK/ui/Canvas/` |
| SDK base + DI container | `packages/standard-ui/src/SDKs/Base.ts`, `SDKManager.ts` |
| Domain models | `packages/shared/domain/` |
| Node drawers (shelf layout) | `packages/shared/constants/drawers.ts` |
| Node authoring SDK | `packages/node-sdk/src/` |
| Node implementations | `packages/nodes/src/` |
| Workflow compiler | `packages/worker/src/turboGraph/` |
| Signal scheduler | `packages/worker/src/S2/engine.ts` |
| Execution engine | `packages/worker/src/engine/index.ts` |
| Sandbox | `packages/worker/src/airlock/` |
| Backend entry | `packages/backend/src/main.ts` |
| Backend DB layer | `packages/backend/src/db/` |
| Backend auth guards | `packages/backend/src/auth/` |
| SQL migrations | `packages/backend/migrations/` |
| Tailwind preset + theme | `packages/standard-ui/src/tailwind-preset.ts` |
| UI component library | `packages/standard-ui/src/foundations/` |
