import { Foundations } from "./Foundations"
import { Shelf } from "./Shelf"
import type { Dependency } from "./Dependency"
import type { Validation } from "./Validation"
import type { Vault } from "./Vault"
import type { Document } from "./Workbench/Document"
import type { Execution } from "./Execution"
import type { Workflow } from "./Workflow"

type Derivative = Foundations.Blueprint.Derivative
type DomainPort = Foundations.Port.Input | Foundations.Port.Output

// What a model reads: the facts of a domain object, trimmed. Flags appear only when set; ids and
// values a model writes back are exact.
export namespace ToolView {

    export interface Field {
        id:            Foundations.Field.Id
        displayName:   string
        variant:       Foundations.Field.Variant
        required?:     true
        reconcile?:    true
        tooltip?:      string
        options?:      string[]
        accepts?:      string[]
        definitionId?: string
        acceptsKind?:  Dependency.Ref.Kind[]
    }

    export interface NodeField extends Field {
        mode:        "static" | "expression"
        switchable?: false
    }

    export interface Port {
        id:             Foundations.Port.Input.Id | Foundations.Port.Output.Id
        displayName?:   string
        variant:        Foundations.Port.Variant
        required?:      true
        isAddedByUser?: true
    }

    export interface Issues {
        fields?:      Record<Foundations.Field.Id, Validation.Issue.Field["type"]>
        inputs?:      Record<Foundations.Port.Input.Id, Validation.Issue.Input["type"]>
        credentials?: Record<Vault.Credential.Template.Id, Validation.Issue.Credential["type"]>
    }

    export interface DerivativeBranch {
        /** The field values that select the branch, from the base down, e.g. "resource==message/message_action==send". */
        path:      string
        adds:      { fields?: Foundations.Field.Id[], inputs?: Foundations.Port.Input.Id[], outputs?: Foundations.Port.Output.Id[], credentialTemplates?: string[] }
        /** Base members the branch drops rather than extends. */
        replaces?: { fields?: Foundations.Field.Id[], inputs?: Foundations.Port.Input.Id[], outputs?: Foundations.Port.Output.Id[] }
    }

    export interface CredentialTemplate {
        templateId:   Vault.Credential.Template.Id
        templateName: string
        optional?:    true
    }

    export interface Blueprint {
        id:                  Foundations.Blueprint.Id
        displayName:         string
        description?:        string
        fields:              Field[]
        inputs:              Port[]
        outputs:             Port[]
        credentials?:        CredentialTemplate[]
        isIgniter?:          true
        passive?:            true
        webhookRoute?:       true
        connectionField?:    string
        isDerivable?:        true
        derivativeBranches?: DerivativeBranch[]
        /** The fields every node has, with their initial values. */
        frameworkFields:     Record<string, unknown>
    }

    /** Edge ids on each port; an edge id reads source|port|target|port. */
    export interface PortEdges {
        incoming?: Record<Foundations.Port.Input.Id,  Workflow.Edge.Id[]>
        outgoing?: Record<Foundations.Port.Output.Id, Workflow.Edge.Id[]>
    }

    /** A credential template the node takes, and the instance attached to it. */
    export interface CredentialSlot {
        templateId:   Vault.Credential.Template.Id
        templateName: string
        optional?:    true
        instanceId:   Vault.Credential.Instance.Id | null
    }

    export interface Node {
        node:            { id: Workflow.Node.Id, blueprintId: Foundations.Blueprint.Id, displayName: string, isDisabled?: true }
        fields:          NodeField[]
        inputs:          Port[]
        outputs:         Port[]
        staticValues:    Record<string, unknown>
        /** The fields every node has, with their current values. */
        frameworkFields: Record<string, unknown>
        credentials?:    CredentialSlot[]
        edges?:          PortEdges
        issues:          Issues | null
    }


    const TOOL_MODE_FIELD = "isConvertedToTool"

    const nonEmpty = <T>(items: readonly T[] | undefined): T[] | undefined =>
        items && items.length > 0 ? [...items] : undefined

    const isFramework = (field: Foundations.Field) => Shelf.Catalogue.FRAMEWORK_FIELD_IDS.has(field.id)

    // The fields a model configures: not hidden, and not the ones every node has.
    const configurable = (fields: readonly Foundations.Field[]) => fields.filter(f => !f.hidden && !isFramework(f))

    // The edge ids on each of a node's ports.
    const portEdges = (d: Document, nodeId: Workflow.Node.Id): PortEdges => {
        const incoming: Record<string, Workflow.Edge.Id[]> = {}
        const outgoing: Record<string, Workflow.Edge.Id[]> = {}

        for (const edge of Object.values(d.cache.edges)) {
            if (edge.target.nodeId === nodeId)
                (incoming[edge.target.portId] ??= []).push(edge.id)

            if (edge.source.nodeId === nodeId)
                (outgoing[edge.source.portId] ??= []).push(edge.id)
        }

        return {
            ...(Object.keys(incoming).length > 0 ? { incoming } : {}),
            ...(Object.keys(outgoing).length > 0 ? { outgoing } : {}),
        }
    }

    export const field = (field: Foundations.Field): ToolView.Field => ({
        id:          field.id,
        displayName: field.displayName,
        variant:     field.variant,
        ...(field.required  ? { required: true }  as const : {}),
        ...(field.reconcile ? { reconcile: true } as const : {}),
        ...(field.tooltip   ? { tooltip: field.tooltip }   : {}),
        ...("options"      in field ? { options: field.options.map(o => o.value) } : {}),
        ...("accepts"      in field ? { accepts: [...field.accepts] }        : {}),
        ...("definitionId" in field && field.definitionId ? { definitionId: field.definitionId } : {}),
        ...("acceptsKind"  in field ? { acceptsKind: [...field.acceptsKind] } : {}),
    })

    export const port = (port: DomainPort): ToolView.Port => ({
        id:      port.id,
        variant: port.variant,
        ...(port.displayName ? { displayName: port.displayName } : {}),
        ...("required" in port && port.required ? { required: true }      as const : {}),
        ...(port.isAddedByUser                   ? { isAddedByUser: true } as const : {}),
    })

    export const issues = (issues: Validation.Issue.Node | null | undefined): Issues | null => {
        if (!issues)
            return null

        const types = <K extends string, V extends { type: string }>(group: Record<K, V>) => {
            const entries = Object.entries(group) as [K, V][]

            return entries.length > 0 ? Object.fromEntries(entries.map(([id, issue]) => [id, issue.type])) as Record<K, V["type"]> : undefined
        }

        const summary: Issues = {
            ...(types(issues.fields)      ? { fields:      types(issues.fields) }      : {}),
            ...(types(issues.inputs)      ? { inputs:      types(issues.inputs) }      : {}),
            ...(types(issues.credentials) ? { credentials: types(issues.credentials) } : {}),
        }

        return Object.keys(summary).length > 0 ? summary : null
    }

    const describe = (condition: Derivative["condition"]) => `${condition.fieldId}${condition.operator}${String(condition.value)}`

    // Every reachable branch of the derivative tree, flattened. Tool mode is a branch too, but not
    // one a caller placing a node would set, so it is left out.
    export const derivativeBranches = (blueprint: Foundations.Blueprint): DerivativeBranch[] => {
        const branches: DerivativeBranch[] = []

        const walk = (derivatives: readonly Derivative[] | undefined, prefix: string) => {
            for (const derivative of derivatives ?? []) {
                if (derivative.condition.fieldId === TOOL_MODE_FIELD)
                    continue

                const path     = prefix ? `${prefix}/${describe(derivative.condition)}` : describe(derivative.condition)
                const replaced = new Set(derivative.replaces ?? [])

                const adds = {
                    fields:              nonEmpty((derivative.fields      ?? []).map(f => f.id)),
                    inputs:              nonEmpty((derivative.inputs      ?? []).map(p => p.id)),
                    outputs:             nonEmpty((derivative.outputs     ?? []).map(p => p.id)),
                    credentialTemplates: nonEmpty((derivative.credentials ?? []).map(t => t.id)),
                }

                const replaces = {
                    ...(replaced.has("fields")  ? { fields:  blueprint.fields.map(f => f.id) }  : {}),
                    ...(replaced.has("inputs")  ? { inputs:  blueprint.inputs.map(p => p.id) }  : {}),
                    ...(replaced.has("outputs") ? { outputs: blueprint.outputs.map(p => p.id) } : {}),
                }

                branches.push({
                    path,
                    adds: Object.fromEntries(Object.entries(adds).filter(([, ids]) => ids)),
                    ...(Object.keys(replaces).length > 0 ? { replaces } : {}),
                })

                walk(derivative._derivatives, path)
            }
        }

        walk(blueprint._derivatives, "")

        // A Variadic field is a slot count rather than a branch: one entry, the template as it repeats.
        for (const field of blueprint.fields) {
            if (field.variant !== "Variadic")
                continue

            branches.push({
                path: `${field.id}==<count>`,
                adds: {
                    ...(nonEmpty(field.template.inputs)  ? { inputs:  field.template.inputs!.map(p => p.id) }  : {}),
                    ...(nonEmpty(field.template.outputs) ? { outputs: field.template.outputs!.map(p => p.id) } : {}),
                },
            })
        }

        return branches
    }

    export const blueprint = (blueprint: Foundations.Blueprint): ToolView.Blueprint => {
        const isDerivable = Foundations.Blueprint.isDerivable(blueprint)
        const branches    = isDerivable ? derivativeBranches(blueprint) : []

        return {
            id:          blueprint.id,
            displayName: blueprint.ui.displayName,
            ...(blueprint.ui.description ? { description: blueprint.ui.description } : {}),
            fields:      configurable(blueprint.fields).map(field),
            inputs:      blueprint.inputs.map(port),
            outputs:     blueprint.outputs.map(port),
            ...(nonEmpty(blueprint.credentials) ? {
                credentials: blueprint.credentials!.map(t => ({
                    templateId:   t.id,
                    templateName: t.displayName,
                    ...(t.optional ? { optional: true } as const : {}),
                })),
            } : {}),
            ...(blueprint.igniter           ? { isIgniter: true }    as const : {}),
            ...(blueprint.passive           ? { passive: true }      as const : {}),
            ...(blueprint.webhooks?.length  ? { webhookRoute: true } as const : {}),
            ...(blueprint.gatewayListener   ? { connectionField: blueprint.gatewayListener.refFieldId } : {}),
            ...(branches.length > 0         ? { isDerivable: true, derivativeBranches: branches } as const : {}),
            frameworkFields: Object.fromEntries(blueprint.fields.filter(isFramework).map(f => [f.id, f.initialValue])),
        }
    }

    export const node = (d: Document, nodeId: Workflow.Node.Id): ToolView.Node => {
        const hydrated = d.selectors.node.hydrate(d, nodeId)

        if (!hydrated)
            throw new Error(`Node ${nodeId} not found`)

        const visible   = configurable(hydrated.fields)
        const framework = hydrated.fields.filter(isFramework)
        const shown     = new Set([...visible.map(f => f.id as string), ...hydrated.inputs.map(p => p.id as string)])
        const current   = d.data.staticValues[nodeId] ?? {}
        const edges     = portEdges(d, nodeId)

        const credentials = d.selectors.credential.getTemplates(d, nodeId).map(template => ({
            templateId:   template.id,
            templateName: template.displayName,
            ...(template.optional ? { optional: true } as const : {}),
            instanceId:   d.selectors.credential.getInstance(d, nodeId, template.id),
        }))

        return {
            node: {
                id:          hydrated.id,
                blueprintId: hydrated.blueprintId,
                displayName: d.selectors.node.getUI(d, nodeId).displayName,
                ...(hydrated.isDisabled ? { isDisabled: true } as const : {}),
            },
            fields: visible.map(f => ({
                ...field(f),
                mode: d.selectors.field.usesExpression(d, nodeId, f) ? "expression" : "static",
                ...(Foundations.Field.canSwitchMode(f) ? {} : { switchable: false } as const),
            })),
            inputs:          hydrated.inputs.map(port),
            outputs:         hydrated.outputs.map(port),
            staticValues:    Object.fromEntries(Object.entries(current).filter(([id]) => shown.has(id))),
            frameworkFields: Object.fromEntries(framework.map(f => [f.id, current[f.id] ?? f.initialValue])),
            ...(credentials.length > 0 ? { credentials } : {}),
            ...(edges.incoming || edges.outgoing ? { edges } : {}),
            issues: issues(d.issues.nodes[nodeId]),
        }
    }


    // ─── Executions ──────────────────────────────────────────────────────

    /** One firing of a node, counted from 1 in the order the node fired. */
    export interface Run {
        nodeId:      Workflow.Node.Id
        run:         number
        status:      "running" | "completed" | "failed" | "idle" | "waiting"
        atMs?:       number
        durationMs?: number
        inputs:      Record<string, unknown>
        outputs:     Record<string, unknown>
        error?:      string
        triggeredBy: string[]
        readFrom:    string[]
    }

    export interface ExecutionOverview {
        executionId: Execution.Id
        status:      Execution.Status
        durationMs:  number
        recorded:    boolean
        note?:       string
        nodes:       number
        runs:        number
        errors:      { nodeId?: Workflow.Node.Id, run?: number, message: string }[]
    }

    const UNRECORDED_NOTE = "Only each node's last run is visible; run again with record: true to see every run."

    const MAX_RUNS  = 10
    const HEAD_RUNS = 3
    const TAIL_RUNS = 5

    const runLabel = (run: Run) => `${run.nodeId}#${run.run}`

    // Every node's firings: from the recording when the run was recorded, else each node's last state from the session.
    export const runs = (execution: Execution): Record<Workflow.Node.Id, Run[]> => {
        const recording = execution.recording
        const byNode    = {} as Record<Workflow.Node.Id, Run[]>

        if (!recording) {
            for (const [nodeId, status] of Object.entries(execution.session.node_status) as [Workflow.Node.Id, Execution.Session.NodeStatus][]) {
                if (status.status === "idle")
                    continue

                const started   = status.started_at   ? Date.parse(status.started_at)   : NaN
                const completed = status.completed_at ? Date.parse(status.completed_at) : NaN

                byNode[nodeId] = [{
                    nodeId,
                    run:         1,
                    status:      status.status,
                    ...(Number.isFinite(started) && Number.isFinite(completed) ? { durationMs: Math.round(completed - started) } : {}),
                    inputs:      {},
                    outputs:     execution.session.node_output_projections[nodeId] ?? {},
                    ...(status.error ? { error: status.error.message } : {}),
                    triggeredBy: [],
                    readFrom:    [],
                }]
            }

            return byNode
        }

        const snapshot = (id: string) => recording.dataBank.snapshots[id as never]?.value
        const position = new Map<string, Run>()

        for (const [nodeId, track] of Object.entries(recording.tracks) as [Workflow.Node.Id, Execution.Recording.Track][]) {
            byNode[nodeId] = track.unitIds.flatMap((unitId, index) => {
                const unit = recording.units[unitId]

                if (!unit)
                    return []

                const run: Run = {
                    nodeId,
                    run:         index + 1,
                    status:      unit.status,
                    atMs:        Math.round(unit.startedAt),
                    ...(unit.duration !== undefined ? { durationMs: Math.round(unit.duration) } : {}),
                    inputs:      Object.fromEntries(Object.entries(unit.inputSnapshot).map(([port, id]) => [port, snapshot(id)])),
                    outputs:     Object.fromEntries(Object.entries(unit.outputSnapshot).map(([port, id]) => [port, snapshot(id)])),
                    ...(unit.error ? { error: unit.error.message } : {}),
                    triggeredBy: [],
                    readFrom:    [],
                }

                position.set(unitId, run)

                return [run]
            })
        }

        for (const relation of Object.values(recording.relations)) {
            const source = position.get(relation.source)
            const target = position.get(relation.target)

            if (!source || !target)
                continue

            const list = relation.type === "signal" ? target.triggeredBy : target.readFrom

            if (!list.includes(runLabel(source)))
                list.push(runLabel(source))
        }

        return byNode
    }

    export const execution = (execution: Execution, byNode = runs(execution)): ExecutionOverview => {
        const all    = Object.values(byNode).flat()
        const errors: ExecutionOverview["errors"] = all
            .filter(run => run.error)
            .map(run => ({ nodeId: run.nodeId, run: run.run, message: run.error! }))

        if (execution.error && !errors.some(e => e.message === execution.error!.message))
            errors.push({ message: execution.error.message })

        return {
            executionId: execution.id,
            status:      execution.status,
            durationMs:  Math.round(execution.duration),
            recorded:    execution.recording !== null,
            ...(execution.recording ? {} : { note: UNRECORDED_NOTE }),
            nodes:       Object.keys(byNode).length,
            runs:        all.length,
            errors,
        }
    }

    // The runs a node view lists: every run up to a limit, else the first and last few, or an asked-for range like "4-9".
    const pickRuns = (all: Run[], range?: string): { shown: Run[], omitted?: number } => {
        if (range) {
            const [from, to] = range.split("-").map(Number)

            return { shown: all.filter(run => run.run >= from && run.run <= (to || from)) }
        }

        if (all.length <= MAX_RUNS)
            return { shown: all }

        return { shown: [...all.slice(0, HEAD_RUNS), ...all.slice(-TAIL_RUNS)], omitted: all.length - HEAD_RUNS - TAIL_RUNS }
    }

    export const executionNode = (all: Run[], range?: string) => {
        const { shown, omitted } = pickRuns(all, range)

        const view = (run: Run) => ({
            run:        run.run,
            status:     run.status,
            ...(run.atMs       !== undefined ? { atMs: run.atMs }             : {}),
            ...(run.durationMs !== undefined ? { durationMs: run.durationMs } : {}),
            ...(run.triggeredBy.length > 0   ? { triggeredBy: run.triggeredBy } : {}),
            ...(run.readFrom.length > 0      ? { readFrom: run.readFrom }       : {}),
            ...(Object.keys(run.inputs).length > 0 ? { inputs: Object.fromEntries(Object.entries(run.inputs).map(([port, value]) => [port, shape(value)])) } : {}),
            outputs:    Object.fromEntries(Object.entries(run.outputs).map(([port, value]) => [port, shape(value)])),
            ...(run.error ? { error: run.error } : {}),
        })

        return {
            totalRuns: all.length,
            runs:      shown.map(view),
            ...(omitted ? { omitted } : {}),
        }
    }

    const isMessage = (value: unknown): value is Record<string, any> =>
        !!value && typeof value === "object" && !Array.isArray(value) && "type" in value && "content" in value

    const messageText = (message: Record<string, any>): string =>
        typeof message.content === "string"
            ? message.content
            : Array.isArray(message.content)
                ? message.content.map((block: any) => typeof block === "string" ? block : block?.text ?? "").join("")
                : ""

    // A value in one line: its kind and size, never its content beyond a short string.
    export const shape = (value: unknown): string => {
        if (value === null || value === undefined)
            return "empty"

        if (typeof value === "string")
            return value.length <= 60 ? JSON.stringify(value) : `Text (${value.length} chars)`

        if (typeof value === "number" || typeof value === "boolean")
            return String(value)

        if (Array.isArray(value))
            return value.length > 0 && value.every(isMessage) ? `MessageList (${value.length})` : `List (${value.length})`

        if (isMessage(value)) {
            const calls = Array.isArray(value.tool_calls) ? value.tool_calls : []
            const kind  = value.type === "ai" ? "AI" : `${String(value.type).charAt(0).toUpperCase()}${String(value.type).slice(1)}`

            return calls.length > 0
                ? `${kind} message, ${calls.length} tool call${calls.length === 1 ? "" : "s"}: ${calls.map((call: any) => call.name).join(", ")}`
                : `${kind} message, ${messageText(value).length} chars`
        }

        const keys = Object.keys(value as object)

        return `Data { ${keys.slice(0, 8).join(", ")}${keys.length > 8 ? `, +${keys.length - 8}` : ""} }`
    }

    // A message without the provider's bookkeeping.
    const message = (value: Record<string, any>) => ({
        type:    value.type,
        content: value.content,
        ...(value.tool_calls?.length ? { tool_calls: value.tool_calls } : {}),
        ...(value.tool_call_id       ? { tool_call_id: value.tool_call_id } : {}),
        ...(value.name               ? { name: value.name } : {}),
    })

    const clean = (value: unknown): unknown =>
        isMessage(value) ? message(value) : Array.isArray(value) ? value.map(clean) : value

    export interface PageOptions {
        path?:   string
        offset?: number
        limit?:  number
    }

    // One value, drilled into by path and paged: lists by item, text by character.
    export const page = (value: unknown, options: PageOptions = {}) => {
        let current = value

        for (const key of (options.path ?? "").split(".").filter(Boolean)) {
            if (current === null || typeof current !== "object" || !(key in (current as object)))
                throw new Error(`Nothing at path ${options.path}`)

            current = (current as Record<string, unknown>)[key]
        }

        const offset = options.offset ?? 0

        if (Array.isArray(current)) {
            const limit = options.limit ?? 10

            return { total: current.length, offset, items: current.slice(offset, offset + limit).map(clean) }
        }

        if (typeof current === "string") {
            const limit = options.limit ?? 4000

            return { length: current.length, offset, text: current.slice(offset, offset + limit) }
        }

        return { value: clean(current) }
    }
}
