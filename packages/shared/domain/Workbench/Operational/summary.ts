import type { Foundations } from "../../Foundations"
import type { Validation } from "../../Validation"
import type { Workflow as WorkflowD } from "../../Workflow"
import type { Document } from "../Document"

// What a read hands back: projections, not dumps. Rows for lists, a fuller shape for one node,
// and the helpers that build them from a document.
type Position = { x: number, y: number }

export namespace Summary {
    export type NodeIssues = Validation.Issue.Node | null

    export interface Node {
        id:          WorkflowD.Node.Id
        blueprintId: Foundations.Blueprint.Id
        displayName: string
        isDisabled:  boolean
        hasIssues:   boolean
    }

    export interface Edge {
        id:     WorkflowD.Edge.Id
        source: WorkflowD.Edge["source"]
        target: WorkflowD.Edge["target"]
    }

    export interface Workflow {
        id:     WorkflowD.Id
        nodes:  Node[]
        edges:  Edge[]
        issues: Validation.Issue.Workflow
    }

    // Filters AND together; an omitted one matches everything. Neighbourhood filters are one
    // hop: `upstreamOf` is the nodes that feed the given ones, `downstreamOf` the nodes they feed.
    export interface NodeQuery {
        ids?:          WorkflowD.Node.Id[]
        blueprintIds?: Foundations.Blueprint.Id[]
        displayName?:  string
        upstreamOf?:   WorkflowD.Node.Id[]
        downstreamOf?: WorkflowD.Node.Id[]
        limit?:        number
    }

    export interface EdgeQuery {
        nodeIds?:       WorkflowD.Node.Id[]
        sourceNodeIds?: WorkflowD.Node.Id[]
        targetNodeIds?: WorkflowD.Node.Id[]
        limit?:         number
    }

    export interface QueryResult<T> {
        items: T[]
        /** How many matched before `limit`. */
        total: number
    }

    export interface NodeLayout {
        id:          WorkflowD.Node.Id
        displayName: string
        position:    Position
        /** Estimated from the node's shape; the canvas measures the real thing. */
        size:        { width: number, height: number }
    }

    export interface Layout {
        nodes:  NodeLayout[]
        bounds: { minX: number, minY: number, maxX: number, maxY: number } | null
    }

    const NODE_WIDTH    = 250
    const HEADER_HEIGHT = 56
    const PORT_ROW      = 28
    const PADDING       = 16

    export const estimateSize = (d: Document, nodeId: WorkflowD.Node.Id) => {
        const shape = d.cache.resolvedShape[nodeId]
        const rows  = Math.max(shape?.inputs.length ?? 0, shape?.outputs.length ?? 0)

        return { width: NODE_WIDTH, height: HEADER_HEIGHT + rows * PORT_ROW + PADDING }
    }

    export const DEFAULT_LIMIT = 50

    export const node = (d: Document, node: WorkflowD.Node.Raw): Node => ({
        id:          node.id,
        blueprintId: node.blueprintId,
        displayName: d.selectors.node.getUI(d, node.id).displayName,
        isDisabled:  node.isDisabled ?? false,
        hasIssues:   d.selectors.node.hasIssues(d, node.id),
    })

    export const edge = (edge: WorkflowD.Edge): Edge => ({
        id:     edge.id,
        source: edge.source,
        target: edge.target,
    })

    export const paginate = <T>(items: T[], limit = DEFAULT_LIMIT): QueryResult<T> => ({
        items: items.slice(0, limit),
        total: items.length,
    })
}
