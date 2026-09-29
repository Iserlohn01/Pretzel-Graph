# Node SDK — Creating Nodes

`@pretzel-graph/node-sdk` is the toolkit for authoring nodes. A node is two files:

- **`blueprint.ts`** — declares the node's identity, fields, input/output ports, and credentials (the *shape*, used by the editor and the type system).
- **`node.ts`** — the `RuntimeNode` subclass that *executes* (the *behavior*, run by the worker).

Conditional fields and ports are declared directly in `blueprint.ts` as derivatives.

Nodes are resolved by a **blueprint-id → path convention**. Blueprint id `Integrations.Postgres.Query` lives at `packages/nodes/src/Integrations/Postgres/Query/{blueprint,node}.ts`. The worker-owned `CatalogueService` dynamic-imports these modules, reading the `Blueprint` export from `blueprint.ts` and the `Node` export from `node.ts`.

Everything a blueprint declares is built with a `define*` helper:

| Helper | Declares |
|---|---|
| `defineBlueprint` | a node |
| `defineTool` | a node's tool-mode surface |
| `defineField.*` | a config field |
| `defineInput.*` / `defineOutput.*` | an input / output port |
| `defineCredential` / `defineOAuth2Credential` | a credential template |
| `defineWebhook` | an inbound webhook |
| `defineLoaders` | ResourceLoader data sources |
| `defineConnection` | a persistent connection (paired with a `GatewaySocket`) |
| `defineGatewayListener` / `defineGatewayHooks` | a node that fires on a connection's events |

---

## Quick start — a minimal node

```ts
// packages/nodes/src/Integrations/Acme/Hello/blueprint.ts
import { defineBlueprint, defineField, defineInput, defineOutput } from "@pretzel-graph/node-sdk";

export const Blueprint = defineBlueprint({
    id: "Integrations.Acme.Hello",
    displayName: "Hello",
    description: "Greets the incoming name.",
    icon: "Acme",                // SystemIcons or integrations name
    accent: "utility",
    fields: [
        defineField.String("greeting", "Greeting", { initialValue: "Hello" }),
    ],
    inputs:  [ defineInput.Text("name", "Name", { required: true }) ],
    outputs: [ defineOutput.Text("message", "Message") ],
});
```

```ts
// packages/nodes/src/Integrations/Acme/Hello/node.ts
import { RuntimeNode, InferIncoming, InferOutputs } from "@pretzel-graph/node-sdk";
import { Blueprint } from "./blueprint";

export class Node extends RuntimeNode<typeof Blueprint> {

    protected override async onRun(
        incoming: InferIncoming<typeof Blueprint>,
    ): Promise<InferOutputs<typeof Blueprint>> {
        return { message: `${this.fieldValues.greeting}, ${incoming.name}!` };
    }
}
```

Then the **three wiring steps** (see the checklist at the bottom):
1. Register the blueprint id in a drawer in `packages/shared/constants/drawers.ts`.
2. If it has a credential, define it under `Credentials/` and export from `Credentials/index.ts`.
3. Run `npm run generate-indexes` in `packages/nodes`.

---

## `defineBlueprint(config)`

| Field | Type | Notes |
|---|---|---|
| `id` | string | Dotted blueprint id; **must** match the folder path. Branded `Blueprint.Id`. |
| `displayName` | string | Shown on the node header. |
| `description` | string | Shown in the shelf / tooltip. |
| `icon` | string | A `SystemIcons` (Lucide-style) or `integrations` name. Unknown names render nothing. |
| `accent` | string? | Header accent, e.g. `"utility"` or a `"port-<Type>"` color. |
| `iconColor` | string? | Icon tint. |
| `fields` | `defineField.*[]` | Static config inputs (the form). |
| `inputs` | `defineInput.*[]` | Typed input ports (left side). |
| `outputs` | `defineOutput.*[]` | Typed output ports (right side). |
| `credentials` | `CredentialTemplate[]?` | Credential templates this node uses. |
| `webhooks` | `defineWebhook(...)[]?` | Inbound webhook definitions. |
| `gatewayListener` | `defineGatewayListener(...)?` | Fire on events from a connection — see [Connections](#connections--gateway-listeners). |
| `toolCompatible` | boolean? | Adds the hidden `isConvertedToTool` field so the node can be switched into tool mode. |
| `proxyCompatible` | boolean? | Appends the network-proxy credential; outbound HTTP made through `httpClientFactory` uses it. |
| `igniter` | boolean? | A trigger node: it never self-starts, and only runs when the run is started from it (manual, webhook, or gateway event). |
| `passive` | boolean? | Exclude from automatic `__START__` wiring; the node only fires when explicitly triggered. |
| `itemScope` | string? | Input port id whose array item-scoped fields iterate over. Must name a declared input. |
| `flags` | record? | Arbitrary node-level flags. |

`defineBlueprint` also appends the standard `signalDependency` / `dataDependency` / `onErrorStrategy` fields, plus `isConvertedToTool` when `toolCompatible` and `ignition_policy` when a `gatewayListener` is declared. They are exported as `StandardFields`; `StandardFields.IDS` holds their ids. A blueprint may redeclare a standard field to change its default.

---

## Fields — `defineField.*`

Fields are the node's **static config form**. Every builder takes `(id, displayName, options)`:

```ts
defineField.Integer("maxResults", "Max Results", { initialValue: 20, min: 1, max: 100 })
```

Shared options: `required?`, `advanced?`, `hidden?`, `tooltip?`, `itemScoped?`. Most builders also take `initialValue?`, `isExpressionInitially?` (start in expression mode) and `only?: "static" | "expression"` (lock the mode).

Do not set `reconcile` manually. `defineBlueprint` marks fields used by derivative conditions so the editor knows when to resolve a new derivative.

| Builder | Value type | Notes |
|---|---|---|
| `String` | string | `multiline?` for a textarea; `placeholder?` |
| `UniqueString` | string | generated per node; `prefix?` `length?` |
| `Integer` / `Float` | number | `min?` `max?` `step?` `slider?` |
| `Boolean` | boolean | renders a switch/checkbox |
| `MultiOption` | option value | `options: [{ value, displayName?, description? }]`, `variant?: "select" \| "tab"`; `initialValue` required |
| `Json` | any JSON | stores a **parsed** object (not a string) |
| `Script` | string | code/SQL editor |
| `Password` / `Secret` | string | masked input |
| `File` | file ref | `fileTypes?` |
| `List` | string[] | |
| `CalendarRange` / `CalendarDateTimeRange` | date range | `placeholder?` |
| `WorkflowIdSelector` | workflow id | picks a workflow from the library |
| `LibraryRef` | library ref | picks a library item; `accepts` lists the kinds, `definitionId?` narrows connections |
| `Dependency` | dependency ref | picks a workflow or skill embedded as a dependency |
| `CaseList` / `Condition` / `Variadic` | — | routing / branching constructs |
| `ResourceLoader` | `{ mode, value }` | dynamic dropdown backed by a loader — see below |

`defineField.itemScoped(field)` marks an existing field as item-scoped, the same as passing `itemScoped: true`.

Read field values at runtime via **`this.fieldValues.<id>`** (typed by `InferFieldValues`).

### Item-scoped fields

An item-scoped field is evaluated once per element of the blueprint's `itemScope` input, with `$item` bound to that element. It is skipped during the normal field pass, so read it with `evalItemField` (one field) or `mapItems` (several fields per element):

```ts
// blueprint: itemScope: "list", fields: [defineField.Boolean("condition", "Condition", { itemScoped: true, isExpressionInitially: true })]
const keep = this.evalItemField("condition", incoming.list, { coerceTo: "boolean" });

const rows = this.mapItems(incoming.list, ({ item, evalField }) => ({
    key:   evalField("key", "string"),
    value: evalField("value"),
}));
```

---

## Ports — `defineInput.*` / `defineOutput.*`

Ports are **typed connections** between nodes. The variant determines connection compatibility, the port color, and (for lists) fan-out semantics. Every builder takes `(id, displayName, options?)`:

```ts
defineInput.Data("payload", "Payload", { required: true })
defineOutput.DataList("rows", "Rows")
```

Input options: `required?`, `tooltip?`, `placeholder?`, `groupId?`, `internal?` (an internal input cannot be required). Output options: `tooltip?`, `groupId?`, `internal?`.

| Variant | Meaning |
|---|---|
| `Message` / `MessageList` | LangChain chat message(s) |
| `Text` | plain string |
| `Data` | **a single item** — a plain object or scalar |
| `DataList` | **an array of items** — fans out downstream (the batch-array model) |
| `DataFrame` *(output)* | tabular data |
| `Document` / `Retriever` / `Embeddings` / `VectorStore` | LangChain RAG handles |
| `LanguageModel` | a chat model handle |
| `Tool` / `ToolList` | LangChain tool(s) |
| `Skill` / `SkillList` | skill(s) |
| `Unresolved` / `UnresolvedScalar` / `UnresolvedList` | polymorphic ports (`polymorphicGroupId`) resolved at wire time |

**Choosing Data vs DataList:** one value → `Data`; a collection that should fan out per-item → `DataList`. (A SQL query's rows = `DataList`; a single summary object = `Data`.)

Read input values in `onRun` via the `incoming` argument (typed by `InferIncoming`); return outputs as `{ <outputId>: value }` (typed by `InferOutputs`).

---

## Credentials — `defineCredential` + `credentials: [...]`

```ts
// packages/nodes/src/Credentials/Acme.ts
import { defineCredential, defineField } from "@pretzel-graph/node-sdk";
export const Acme = defineCredential({
    id: "acmeApi",
    displayName: "Acme",
    icon: "Acme",
    fields: [ defineField.Password("apiKey", "API Key", { required: true }) ],
});
```

Pass `optional: true` when the node can run without the credential attached.

Declare it on the blueprint (`credentials: [Acme]`), then read it at runtime:

```ts
const { apiKey } = this.context.credentialsAPI.getDecryptedValue(this.credentials.acmeApi.blob);
```

Credential field values are **type-preserving** (`Vault.DecryptedValues` is a union) — an `Integer` field decrypts to a `number`, a `Boolean` to a `boolean`. `getDecryptedValue` returns those types via `InferCredentialValues`. Re-export every credential from `Credentials/index.ts`.

### OAuth2

`defineOAuth2Credential({ id, displayName, fields, icon?, provider })` declares a credential whose tokens arrive through the OAuth callback; `fields` are what the form collects before the redirect. Providers ship with the SDK (e.g. `googleOAuth2Provider`). At runtime, ask for a token instead of decrypting:

```ts
const token = await this.context.credentialsAPI.getAccessToken(this.credentials.googleSheetsOAuth.id);
```

`getAccessToken` refreshes as needed and resolves to a token valid for at least the next minute.

---

## The `RuntimeNode` class

Subclass `RuntimeNode<typeof Blueprint>` (optionally `<typeof Blueprint, typeof ToolBlueprint>`). Override the lifecycle hooks you need — only `onRun` is required.

| Hook | When | Returns |
|---|---|---|
| `onRun(incoming)` *(required)* | normal execution | `Partial<InferOutputs>` |
| `onCompile(ctx)` | once, at graph compile time | — |
| `onIgniter(igniter)` | the execution's igniter is handed to the node (trigger nodes) | — |
| `onWebhook(payload)` | an inbound webhook arrives | — |
| `onBuildTool(incoming)` | tool mode on a node with a separate `ToolBlueprint`; defaults to `onRun` | tool outputs |
| `onWorkflowEnding(outcome)` | the enclosing workflow finishes a run (`"completed"` / `"terminated"` / `"failed"`) | — |
| `onRecordMetrics({inputs,outputs,unitId,status,duration})` | after a run, to record metrics | `Record<id, Metric>` |

Class-level controls:
- `protected readonly PROPAGATION_STRATEGY` — `"router"` (default; only ports present in the result) / `"all"` (every downstream dependent) / `"none"` (node handled propagation itself). Read by the engine through `getPropagationStrategy()`.
- `public readonly CATCHES_ERROR = true` — an incoming error envelope is materialized to this node instead of re-propagating.
- `static loaders = defineLoaders<typeof Blueprint>()({ ... })` — ResourceLoader data sources (see below).
- `static gatewayHooks = defineGatewayHooks<typeof Blueprint>()(...)` — connection event handling (see below).

Inside a node you have:
- `this.nodeId` — the workflow node id.
- `this.fieldValues` — evaluated field values (`InferFieldValues`).
- `this.credentials` — credential instances (`InferCredentials`).
- `this.context` — the node's `ExecutionContext` (APIs below).
- `this.httpClientFactory.create(config)` — build every outbound HTTP client here, so the node's proxy credential is applied.
- `this.AbortablePromise((resolve, reject, signal) => …)` — a promise that rejects on abort.
- `this.evalItemField(...)` / `this.mapItems(...)` — evaluate item-scoped fields (see above).
- `this.incomingFor(fields, incoming)` — retypes `incoming` against narrowed field values, so ports declared by a derivative branch are readable:

```ts
if (this.fieldValues.shape === "text") {
    const input = this.incomingFor(this.fieldValues, incoming);
    input.suffix;   // declared by the shape==text branch
}
```

### `this.context` — ExecutionContext APIs

| API | Purpose |
|---|---|
| `executionId` / `workflowId` / `igniter` | identity of the current run |
| `session` / `updateSession(recipe)` | read / mutate the execution session |
| `log` | structured logger |
| `credentialsAPI` | `getInstance(id)`, `getDecryptedValue(blob)`, `getAccessToken(id)` |
| `connectionAPI` | pooled database / MCP clients — see below |
| `httpAPI` / `proxyAPI` | raw HTTP client factory and proxy agents; prefer `this.httpClientFactory` |
| `internalAPI` | HTTP client for the backend's internal routes; carries the execution token and is never proxied |
| `realtimeAPI` | events and signals — see below |
| `consultationAPI` | `consult(...)` — ask the user and wait for an answer |
| `airlockAPI` | run expressions in the execution's sandbox |
| `portAPI.write(nodeId, outputId, value)` | imperatively write an output port |
| `propagationAPI.emitPort/emitNode` | fan out a signal manually |
| `schedulerAPI` | `fireNode`, `signalNode`, `removeSignal`, `clearSignals`, `scheduleCheck` |
| `instanceRegistryAPI` | `get(nodeId)` / `getAll()` running node instances |
| `workflowQueryAPI` | read the workflow: `getBlueprint`, `getNode`, `getNodesByBlueprint`, `getNodeOutput`, `getInputs` / `getOutputs` / `getFields`, `getInputPort` / `getOutputPort`, `hasOutputEdge`, `getStaticValues`, `getCredentialIds`, `getNodeDependency` |
| `abortAPI` | `signal`, `abort(reason)` |
| `agentToolBridgeAPI` | `bind(tools)` — expose live `Tool` values on a short-lived, authenticated MCP endpoint for an external agent process |
| `subWorkflowAPI` | `createEnv()` → `{ compile, run }` for a nested workflow |
| `enclosingNodeAPI` | inside a sub-workflow: write / emit ports on the parent node |
| `dependencyAPI` | `get(ref)` — resolve an embedded workflow dependency |

### Realtime — `this.context.realtimeAPI`

- `emit(event)` — publish an execution event to the client.
- `onSignal(schema, handler)` — permanent handler for inbound signals; returns an unregister function.
- `awaitSignal(schema, match, timeout)` — park until a signal passes both the schema and `match`, or reject on timeout / terminate / suspend. `match` is required so two nodes waiting on the same kind of signal don't both resolve on one reply.
- `awaitSignalAfter(schema, match, timeout, action)` — the same, with the waiter registered before `action` runs; use it when `action` is what invites the reply.

### Consultations — `this.context.consultationAPI.consult`

Asks the user something and parks until they answer. The request is mirrored onto the session so a client joining mid-run sees it; it rejects on timeout, terminate, or suspend.

```ts
const answer = await this.context.consultationAPI.consult({
    requestSchema: Acme.Consultation.Request,     // validates the stamped request
    answerSchema:  Acme.Consultation.Answer,      // validates the reply
    request:       { nodeId: this.nodeId, variant: "acme", timeoutMs: 60_000 },
    onOpen:        request => registerReplyRoute(request.id),   // optional; runs once the waiter is armed
});
```

`consult` stamps `id` and `startedAt` on the request itself.

---

## Type inference

All derived from `typeof Blueprint` (the static blueprint), keyed by field/port literal id:

- `InferFieldValues<B>` — `this.fieldValues` shape (a union narrowed by derivative discriminants)
- `InferIncoming<B>` — `onRun` argument
- `InferOutputs<B>` — `onRun` return
- `InferItemFields<B>` — item-scoped fields, as read by `evalItemField` / `mapItems`
- `InferCredentials<B>` — `this.credentials` shape
- `InferCredentialValues<T>` — decrypted credential values

---

## ResourceLoader fields + `defineLoaders`

A `ResourceLoader` field is a dynamic dropdown whose options come from a **loader** — a function on the node that fetches at edit time (e.g. list a user's spreadsheets). Loaders run in the backend, outside any execution, with the node's credentials injected.

```ts
static loaders = defineLoaders<typeof Blueprint>()({
    async projects({ credentials, credentialsAPI, searchQuery, paginationCursor }) {
        const { apiKey } = credentialsAPI.getDecryptedValue(credentials.acmeApi.blob);
        const page = await listAcmeProjects(apiKey, { query: searchQuery, cursor: paginationCursor });
        return {
            options: page.items.map(p => ({ label: p.name, value: p.id })),
            nextPaginationCursor: page.next,
        };
    },
});
```

`Loader.Context` gives `fieldValues` (typed `InferFieldValues`), `credentials` + `credentialsAPI` (`getInstance`, `getDecryptedValue`, `getAccessToken`), `searchQuery`, `paginationCursor`. It has no `connectionAPI`; a loader opens whatever client it needs itself. A field declares `loaderId: "projects"` and may declare `dependsOn: ["otherField"]` so changing the dependency re-fetches:

```ts
defineField.ResourceLoader("board", "Board", { loaderId: "boards", dependsOn: ["project"] })
```

---

## Inline derivatives — operation-driven schemas

Add condition keys to the object passed to `defineBlueprint`. A matching branch contributes fields, inputs, outputs, credentials, or UI overrides to the resolved blueprint. Conditions can nest, and `InferFieldValues` narrows the resulting runtime values without casts.

```ts
export const Blueprint = defineBlueprint({
    id: "Integrations.Acme.Database",
    displayName: "Acme Database",
    description: "Reads and writes values.",
    icon: "Database",
    fields: [
        defineField.MultiOption("operation", "Operation", {
            options: [
                { value: "GET", displayName: "Get" },
                { value: "SET", displayName: "Set" },
            ],
            initialValue: "GET",
        }),
        defineField.String("key", "Key", { required: true }),
    ],
    inputs: [],
    outputs: [defineOutput.Data("result", "Result")],

    "operation==GET": {},
    "operation==SET": {
        fields: [defineField.String("value", "Value")],
    },
});
```

Use `field==value` or `field!=value`. Branch members are additive by default; use `replaces` when a branch must replace an existing member. The compiler validates condition fields and option values when the blueprint module loads, stamps condition fields as derivative triggers, and serializes the branches into `_derivatives`. Runtime and Shelf resolution use only this serialized derivative tree.

Framework fields are in scope for conditions, so a blueprint can branch on `isConvertedToTool` without declaring it.

---

## Tool mode — `defineTool`

A `toolCompatible` node can be switched into tool mode, where it outputs tools for an agent instead of running one action. Declare that surface with `defineTool` under the framework condition key:

```ts
toolCompatible: true,

"isConvertedToTool==true": defineTool({
    fields:  [defineField.Integer("maxResults", "Default Max Results", { initialValue: 20 })],
    outputs: [defineOutput.ToolList("tools", "Tools")],
}),
```

A `defineTool` branch **replaces** the run-mode fields and ports rather than adding to them, and nothing can nest inside it. Framework fields survive the replacement, so the editor can still toggle back. The branch defaults its accent to `port-Tool`.

At runtime `onRun` narrows on `this.fieldValues.isConvertedToTool` and returns whatever the resolved blueprint declares. `onBuildTool` is only needed for nodes that use a separate `ToolBlueprint` type parameter.

---

## Database and MCP connections — `connectionAPI`

The worker owns pooled clients, so reuse across a run and cleanup on suspend operate on the same live connections. Nodes reach them through `this.context.connectionAPI`; the SDK exports the credential converters: `toPgCreds`, `toMySqlCreds`, `toRedisCreds`, `toMongoCreds`, `toMcpCreds`.

| Client | Call |
|---|---|
| `postgres` / `mysql` | `withConnection(creds, conn => …)` — borrows a pooled connection for the callback |
| `redis` / `mongo` / `mcp` | `get(creds)` — resolves to a shared client |

```ts
const creds  = toPgCreds(this.context.credentialsAPI.getDecryptedValue(this.credentials.postgres.blob));
const result = await this.context.connectionAPI.postgres.withConnection(creds, c => c.query(this.fieldValues.query));
return { rows: result.rows };
```

---

## Connections + gateway listeners

A **connection** is a long-lived socket (a chat bot, a WebSocket feed) that a user creates once in the library and that workflows listen to. It is two files under `packages/nodes/src/Connections/<Name>/`:

- **`definition.ts`** — `export const Definition = defineConnection({ id: "Connections.<Name>", provider, displayName, icon, fields, credentials })`. A connection takes at most one credential; condition keys may add fields or that one credential, never ports.
- **`socket.ts`** — a `GatewaySocket<typeof Definition>` subclass exported as `Socket`. It implements `connect()`, `disconnect()`, and `dispatchEvent(...)`, reads `this.fieldValues` / `this.credential`, and reports through its `SocketContext`: `dispatch(event)`, `identify(remoteId)`, `fail(error)`.

A node that fires on those events declares a `LibraryRef` field accepting connections and points `gatewayListener` at it:

```ts
fields: [
    defineField.LibraryRef("connection", "Connection", { accepts: ["connection"], definitionId: "Connections.Acme", required: true }),
],
gatewayListener: defineGatewayListener({ refFieldId: "connection" }),
igniter: true,
```

The node class then attaches `static gatewayHooks = defineGatewayHooks<typeof Blueprint>()(EventSchema, { scope?, filter, recorder?, igniter? })`, which decides which events belong to which conversation, which ones start a run, and what the run receives. The event arrives in `onIgniter(igniter)` with `igniter.variant === "gateway_event"`. See `Integrations/Discord/Events` for a full example.

---

## Checklist for a new node

1. `blueprint.ts` + `node.ts` under the path matching the blueprint id; declare conditional shapes as inline derivatives.
2. Export `export const Blueprint` from `blueprint.ts` and `export class Node` from `node.ts` — the catalogue resolves both by path convention off those export names.
3. Credential (if any): define under `Credentials/`, re-export from `Credentials/index.ts`.
4. Register the blueprint id in the right drawer in `packages/shared/constants/drawers.ts`.
5. `npm run generate-indexes` in `packages/nodes` (refreshes `packages/backend/assets/blueprint_index.json` and `gateway_definitions_index.json`).
6. Typecheck: `npx tsc -p packages/nodes/tsconfig.json --noEmit` (and `node-sdk` / `shared` if you touched them).
