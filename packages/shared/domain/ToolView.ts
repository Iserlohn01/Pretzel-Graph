import { Foundations } from "./Foundations"
import { Shelf } from "./Shelf"
import type { Dependency } from "./Dependency"
import type { Validation } from "./Validation"
import type { Vault } from "./Vault"
import type { Document } from "./Workbench/Document"
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
}
