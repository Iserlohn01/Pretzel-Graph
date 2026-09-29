import type { Document } from "../Document"
import type { Event } from "../event"
import type { BlueprintResolver, CredentialResolver, DependencyResolver, OnOperation, Operation } from "./types"
import { WorkflowOperations } from "./workflow"
import { NodeOperations } from "./node"
import { EdgeOperations } from "./edge"
import { FieldOperations } from "./field"
import { GlobalFieldOperations } from "./globalField"
import { CredentialOperations } from "./credential"

export type Mode = "read" | "write"

export interface BatchResult {
    results: unknown[]
    failed?: { index: number, op: Operation["op"], message: string }
}

/**
 * What can be asked of a workflow document, in the terms a caller uses: a group per target, a
 * method per operation, over the document loaded here. Loaded for reading, only the reads
 * answer; loaded for writing, each write runs the reducer with what the canvas does around it —
 * derive on a reconciling field, validate, recompute cycles once — and reports itself to
 * `onOperation` as the event a listener replays. Reads return projections, not dumps.
 */
export class OperationalClient {

    public readonly workflow    = new WorkflowOperations(this)
    public readonly node        = new NodeOperations(this)
    public readonly edge        = new EdgeOperations(this)
    public readonly field       = new FieldOperations(this)
    public readonly globalField = new GlobalFieldOperations(this)
    public readonly credential  = new CredentialOperations(this)

    #document: Document | null = null
    #mode:     Mode            = "read"

    constructor(
        public readonly resolveBlueprint:  BlueprintResolver,
        public readonly resolveCredential: CredentialResolver,
        public readonly resolveDependency: DependencyResolver,
        public readonly onOperation:       OnOperation,
    ) {}

    public get isLoaded(): boolean {
        return this.#document !== null
    }

    public get isWritable(): boolean {
        return this.#document !== null && this.#mode === "write"
    }

    public load(document: Document, mode: Mode = "read"): this {
        this.#document = document
        this.#mode     = mode
        return this
    }

    public unload(): void {
        this.#document = null
        this.#mode     = "read"
    }

    /** The loaded document. Reads use this. */
    public get document(): Document {
        if (!this.#document)
            throw new Error("No document loaded")

        return this.#document
    }

    /** The loaded document, only while it was loaded for writing. Writes use this. */
    public getDocument(): Document {
        if (!this.#document || this.#mode !== "write")
            throw new Error("Document is not open for writing")

        return this.#document
    }

    public report(edit: Event.Unstamped): void {
        this.onOperation(edit)
    }

    /** In order; stops at the first failure, what landed before it stays applied and is returned. */
    public async batch(operations: Operation[]): Promise<BatchResult> {
        const results: unknown[] = []

        for (const [index, op] of operations.entries()) {
            try {
                results.push(await this.apply(op))
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error)

                return { results, failed: { index, op: op.op, message } }
            }
        }

        return { results }
    }

    private apply(op: Operation): Promise<unknown> | unknown {
        switch (op.op) {
            case "node.create":          return this.node.create(op)
            case "node.delete":          return this.node.delete(op.nodeId)
            case "node.move":            return this.node.move(op.nodeId, op.position)
            case "node.addInputPort":    return this.node.input.addPort(op.nodeId, op.port)
            case "node.removeInputPort": return this.node.input.removePort(op.nodeId, op.portId)
            case "node.updateInputPort": return this.node.input.updatePort(op.nodeId, op.portId, op.port)
            case "edge.create":          return this.edge.create(op)
            case "edge.delete":          return this.edge.delete(op.edgeId)
            case "field.set":            return this.field.set(op.nodeId, op.fieldId, op.value, op.mode)
            case "credential.setInstance": return this.credential.setInstance(op.nodeId, op.templateId, op.instanceId)
            case "globalField.add":      return this.globalField.add(op)
            case "globalField.update":   return this.globalField.update(op.fieldId, op.patch)
            case "globalField.remove":   return this.globalField.remove(op.fieldId)
        }
    }
}

export { Summary } from "./summary"
export { ID_PATTERN } from "./types"
export type { FieldMode } from "./types"
export type { BlueprintResolver, CredentialResolver, DependencyResolver, OnOperation, Operation, CreateNodeRequest, InputPortSpec, GlobalFieldSpec, GlobalFieldPatch, GlobalFieldVariant, Position, Connection } from "./types"
