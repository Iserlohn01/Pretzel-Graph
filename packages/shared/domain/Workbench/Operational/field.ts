import { Dependency } from "../../Dependency"
import { Foundations } from "../../Foundations"
import type { Workflow } from "../../Workflow"
import { Document, type DeriveResult } from "../Document"
import type { Summary } from "./summary"
import type { FieldMode } from "./types"
import type { OperationalClient } from "."

const { withCyclesRecompute } = Document

const QUOTED     = /(["'`])(?:\\[\s\S]|(?!\1)[^\\])*\1/g
const TEMPLATING = /\{\{[\s\S]*?\}\}/

/** Rejects `{{ }}` templating outside string and template literals in an expression. */
export function assertNoTemplating(fieldId: Foundations.Field.Id, value: unknown): void {
    if (typeof value !== "string" || !TEMPLATING.test(value.replace(QUOTED, `""`)))
        return

    throw new Error(`Field ${fieldId}: {{ }} is not expression syntax. An expression is one JavaScript expression, e.g. $in.text, or text as a template literal: \`Hello \${$in.name}\`. For fixed text, switch the field to static.`)
}

export class FieldOperations {

    constructor(private readonly client: OperationalClient) {}

    public get(nodeId: Workflow.Node.Id, fieldId: Foundations.Field.Id): { value: Foundations.Field.Value | null, mode: FieldMode | null } {
        const d     = this.client.document
        const field = d.selectors.field.get(d, nodeId, fieldId)

        return { value: d.selectors.node.getStaticValue(d, nodeId, fieldId), mode: field ? this.getMode(d, nodeId, field) : null }
    }

    /** With a mode, the field switches to it first, so the value is read in that mode. */
    public async set(nodeId: Workflow.Node.Id, fieldId: Foundations.Field.Id, value: unknown, mode?: FieldMode): Promise<{ nodeId: Workflow.Node.Id, fieldId: Foundations.Field.Id, mode: FieldMode, issues: Summary.NodeIssues, derivation: DeriveResult | null }> {
        if (mode)
            this.setMode(nodeId, fieldId, mode)

        const target = this.client.document.selectors.field.get(this.client.document, nodeId, fieldId)

        if (target?.variant === "Dependency" && value !== null)
            return this.setDependency(nodeId, target, value)

        return withCyclesRecompute((d: Document) => {
            const field = d.selectors.field.get(d, nodeId, fieldId)
            if (!field)
                throw new Error(`Field ${fieldId} not found on node ${nodeId}`)

            if (this.getMode(d, nodeId, field) === "expression")
                assertNoTemplating(fieldId, value)

            // A reconciling field reshapes the node; what that added, removed, and disconnected
            // comes back so the caller can see the cost of the change.
            const derivation = field.reconcile
                ? d.reducers.node.derive(d, nodeId, { ...d.selectors.field.getValues(d, nodeId), [fieldId]: value as never })
                : null

            d.reducers.field.setValue(d, nodeId, fieldId, value as never)
            d.reducers.node.validate(d, nodeId)
            this.client.report({ type: "field:set", nodeId, fieldId, value })

            return { nodeId, fieldId, mode: this.getMode(d, nodeId, field), issues: d.issues.nodes[nodeId] ?? null, derivation }
        })(this.client.getDocument())
    }

    /** Switches a field between static and expression mode, re-encoding its stored value. */
    public setMode(nodeId: Workflow.Node.Id, fieldId: Foundations.Field.Id, mode: FieldMode): { nodeId: Workflow.Node.Id, fieldId: Foundations.Field.Id, mode: FieldMode, value: Foundations.Field.Value | null, issues: Summary.NodeIssues } {
        const d     = this.client.getDocument()
        const field = d.selectors.field.get(d, nodeId, fieldId)

        if (!field)
            throw new Error(`Field ${fieldId} not found on node ${nodeId}`)

        const current = this.getMode(d, nodeId, field)

        if (current !== mode && !Foundations.Field.canSwitchMode(field))
            throw new Error(`Field ${fieldId} is always ${current}; its mode cannot be changed`)

        if (current !== mode) {
            d.reducers.field.setIsExpression(d, nodeId, fieldId, mode === "expression")
            d.reducers.node.validate(d, nodeId)
            this.client.report({ type: "field:modeSet", nodeId, fieldId, mode })
        }

        return { nodeId, fieldId, mode, value: d.selectors.node.getStaticValue(d, nodeId, fieldId), issues: d.issues.nodes[nodeId] ?? null }
    }

    /** Points the field at a dependency and embeds its snapshot, reusing the one the workflow already has. */
    public async attachDependency(nodeId: Workflow.Node.Id, fieldId: Foundations.Field.Id, ref: Dependency.Ref): Promise<void> {
        const embedded = this.client.document.selectors.dependency.get(this.client.document, ref)
        const snapshot = embedded ?? await this.client.resolveDependency(ref)

        withCyclesRecompute((d: Document) => {
            d.reducers.field.dependency.setValue(d, nodeId, fieldId, ref, snapshot)
            this.client.report({ type: "field:dependencySet", nodeId, fieldId, ref })
        })(this.client.getDocument())
    }

    private async setDependency(nodeId: Workflow.Node.Id, field: Foundations.Field.Dependency, value: unknown) {
        const ref = Dependency.Ref.Schema.parse(value)

        if (!field.acceptsKind.includes(ref.kind))
            throw new Error(`Field ${field.id} accepts ${field.acceptsKind.join(", ")}, not ${ref.kind}`)

        await this.attachDependency(nodeId, field.id, ref)

        const d = this.client.getDocument()

        return { nodeId, fieldId: field.id, mode: this.getMode(d, nodeId, field), issues: d.issues.nodes[nodeId] ?? null, derivation: null }
    }

    public getMode(d: Document, nodeId: Workflow.Node.Id, field: Foundations.Field): FieldMode {
        return d.selectors.field.usesExpression(d, nodeId, field) ? "expression" : "static"
    }
}
