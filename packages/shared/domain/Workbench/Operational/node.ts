import { Foundations } from "../../Foundations"
import { Port } from "../../Foundations/Port"
import { Workflow } from "../../Workflow"
import { Document } from "../Document"
import { Summary } from "./summary"
import { ID_PATTERN, type CreateNodeRequest, type InputPortSpec, type Position } from "./types"
import type { OperationalClient } from "."

const { withCyclesRecompute } = Document

const NODE_GAP = 400

// A caller with no opinion on geometry gets the next slot in a row; the canvas can tidy later.
const placeNext = (d: Document): Position => {
    const positions = Object.values(d.data.ui.layout)

    if (positions.length === 0)
        return { x: 0, y: 0 }

    const rightmost = positions.reduce((a, b) => (b.x > a.x ? b : a))

    return { x: rightmost.x + NODE_GAP, y: rightmost.y }
}

export class NodeOperations {

    constructor(private readonly client: OperationalClient) {}

    public get(nodeId: Workflow.Node.Id): Summary.NodeDetail {
        const d    = this.client.document
        const node = d.data.nodes[nodeId]

        if (!node)
            throw new Error(`Node ${nodeId} not found`)

        const shape = d.cache.resolvedShape[nodeId]

        return {
            node,
            fields:         shape?.fields  ?? [],
            inputs:         shape?.inputs  ?? [],
            outputs:        shape?.outputs ?? [],
            staticValues:   d.selectors.node.getStaticValues(d, nodeId),
            fieldModes:     Object.fromEntries((shape?.fields ?? []).map(field => [field.id, {
                mode:       this.client.field.getMode(d, nodeId, field),
                switchable: Foundations.Field.canSwitchMode(field),
            }])),
            credentials:    d.selectors.credential.getTemplates(d, nodeId).map(template => ({
                templateId:   template.id,
                templateName: template.displayName,
                optional:     template.optional ?? false,
                instanceId:   d.selectors.credential.getInstance(d, nodeId, template.id),
            })),
            connectedEdges: Summary.connectedEdges(d, nodeId),
            issues:         d.issues.nodes[nodeId] ?? null,
        }
    }

    // A new node starts on its base branch with plain values only. A reconciling field
    // reshapes the node, so it is set afterwards through field.set, which reports the reshape.
    public async create(request: CreateNodeRequest): Promise<{ nodeId: Workflow.Node.Id, issues: Summary.NodeIssues }> {
        const d         = this.client.getDocument()
        const blueprint = await this.client.resolveBlueprint(request.blueprintId)
        const fields    = new Map(blueprint.fields.map(f => [f.id as string, f]))
        const inputs    = new Set(blueprint.inputs.map(i => i.id as string))

        for (const id of Object.keys(request.staticValues ?? {})) {
            const field = fields.get(id)

            if (field?.reconcile)
                throw new Error(`Field ${id} reshapes the node; create it first, then set the field`)

            if (!field && !inputs.has(id))
                throw new Error(`Unknown field ${id}; the base has ${[...fields.keys()].join(", ") || "no fields"}`)
        }

        const position = request.position ?? placeNext(d)
        const nodeId   = withCyclesRecompute((d: Document) => d.reducers.node.create(d, blueprint, position, request.staticValues as never))(d)

        this.client.report({
            type:         "node:created",
            node:         d.data.nodes[nodeId],
            position:     d.data.ui.layout[nodeId],
            staticValues: d.data.staticValues[nodeId] ?? {},
        })

        // A node that runs a workflow needs that workflow's snapshot; without it the node is removed.
        const shapeRef = d.selectors.node.dependency.getShapeRef(d, nodeId)

        if (shapeRef && !d.selectors.dependency.get(d, shapeRef)) {
            try {
                await this.client.field.attachDependency(nodeId, Workflow.Node.SHAPE_DEPENDENCY_FIELD_ID, shapeRef)
            }
            catch (error) {
                this.delete(nodeId)

                throw new Error(`Could not load the workflow ${blueprint.id} runs: ${(error as Error).message}`)
            }
        }

        return { nodeId, issues: d.issues.nodes[nodeId] ?? null }
    }

    public delete(nodeId: Workflow.Node.Id): { nodeId: Workflow.Node.Id } {
        return withCyclesRecompute((d: Document) => {
            if (!d.data.nodes[nodeId])
                throw new Error(`Node ${nodeId} not found`)

            d.reducers.node.remove(d, nodeId)
            this.client.report({ type: "node:deleted", nodeId })

            return { nodeId }
        })(this.client.getDocument())
    }

    public move(nodeId: Workflow.Node.Id, position: Position): { nodeId: Workflow.Node.Id, position: Position } {
        const d = this.client.getDocument()

        if (!d.data.nodes[nodeId])
            throw new Error(`Node ${nodeId} not found`)

        d.reducers.layout.node.setPosition(d, nodeId, position)
        this.client.report({ type: "node:moved", nodeId, position })

        return { nodeId, position }
    }

    public readonly input = {
        /** A hand-added input port: a concrete type, never an unresolved one, since it belongs to no group. */
        addPort: (nodeId: Workflow.Node.Id, spec: InputPortSpec): { nodeId: Workflow.Node.Id, port: Port.Input } => {
            const d    = this.client.getDocument()
            const node = d.data.nodes[nodeId]

            if (!node)
                throw new Error(`Node ${nodeId} not found`)

            if (d.selectors.node.dependency.getShapeRef(d, nodeId))
                throw new Error(`Node ${nodeId} runs a sub-workflow; its ports are the sub-workflow's`)

            if (Port.isUnresolvedLike(spec.variant))
                throw new Error(`Port type ${spec.variant} resolves from a group; a hand-added port needs a concrete type`)

            if (!ID_PATTERN.test(spec.id))
                throw new Error(`Port id ${spec.id} may only contain letters, digits and underscores`)

            if (d.selectors.node.ports.getInputs(d, nodeId).some(i => i.id === spec.id))
                throw new Error(`Input port ${spec.id} already exists on ${nodeId}`)

            const port = Port.Input.Schema.parse({
                id:            spec.id,
                displayName:   spec.displayName,
                variant:       spec.variant,
                required:      spec.required ?? false,
                isAddedByUser: true,
            })

            d.reducers.port.addInput(d, nodeId, port)
            this.client.report({ type: "node:inputPortAdded", nodeId, port })

            return { nodeId, port }
        },

        removePort: (nodeId: Workflow.Node.Id, portId: Port.Input.Id): { nodeId: Workflow.Node.Id, portId: Port.Input.Id } => {
            return withCyclesRecompute((d: Document) => {
                const node = d.data.nodes[nodeId]

                if (!node)
                    throw new Error(`Node ${nodeId} not found`)

                if (!node.addedInputs?.some(p => p.id === portId))
                    throw new Error(`Input port ${portId} on ${nodeId} is not a hand-added port; only those can be removed`)

                d.reducers.port.removeInput(d, nodeId, portId)
                this.client.report({ type: "node:inputPortRemoved", nodeId, portId })

                return { nodeId, portId }
            })(this.client.getDocument())
        },

        updatePort: (nodeId: Workflow.Node.Id, portId: Port.Input.Id, spec: InputPortSpec): { nodeId: Workflow.Node.Id, port: Port.Input } => {
            return withCyclesRecompute((d: Document) => {
                const node = d.data.nodes[nodeId]

                if (!node)
                    throw new Error(`Node ${nodeId} not found`)

                if (!node.addedInputs?.some(p => p.id === portId))
                    throw new Error(`Input port ${portId} on ${nodeId} is not a hand-added port; only those can be edited`)

                if (Port.isUnresolvedLike(spec.variant))
                    throw new Error(`Port type ${spec.variant} resolves from a group; a hand-added port needs a concrete type`)

                if (!ID_PATTERN.test(spec.id))
                    throw new Error(`Port id ${spec.id} may only contain letters, digits and underscores`)

                if (spec.id !== portId && d.selectors.node.ports.getInputs(d, nodeId).some(i => i.id === spec.id))
                    throw new Error(`Input port ${spec.id} already exists on ${nodeId}`)

                const port = Port.Input.Schema.parse({
                    id:            spec.id,
                    displayName:   spec.displayName,
                    variant:       spec.variant,
                    required:      spec.required ?? false,
                    isAddedByUser: true,
                })

                d.reducers.port.updateInput(d, nodeId, portId, port)
                this.client.report({ type: "node:inputPortUpdated", nodeId, portId, port })

                return { nodeId, port }
            })(this.client.getDocument())
        },
    }
}
