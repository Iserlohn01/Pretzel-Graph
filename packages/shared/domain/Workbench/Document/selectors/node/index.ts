import { Airlock } from "../../../../Airlock";
import type { Workflow } from "../../../../Workflow";
import type { Execution } from "../../../../Execution";
import type { Foundations } from "../../../../Foundations";
import type { Field } from "../../../../Foundations/Field";
import type { Port } from "../../../../Foundations/Port";
import type { Blueprint } from "../../../../Foundations/Blueprint";
import type { Document } from "../../index";
import { executionSelectors } from "../execution";
import { nodeDependencySelectors, type NodeDependencySelectors } from "./dependency";
import { nodeEdgeSelectors, type NodeEdgeSelectors } from "./edge";
import { nodePortSelectors, type NodePortSelectors } from "./port";

export type { PortGroup } from "./port";

export interface NodeSelectors {
    get:              (document: Document, nodeId: Workflow.Node.Id) => Workflow.Node.Raw
    hasIssues:        (document: Document, nodeId: Workflow.Node.Id) => boolean
    isTool:           (document: Document, nodeId: Workflow.Node.Id) => boolean
    isSourceNode:     (document: Document, nodeId: Workflow.Node.Id) => boolean
    isSinkNode:       (document: Document, nodeId: Workflow.Node.Id) => boolean
    getStaticValues:      (document: Document, nodeId: Workflow.Node.Id) => Record<Field.Id | Port.Id, any> | null
    getStaticValue:       (document: Document, nodeId: Workflow.Node.Id, id: Field.Id | Port.Input.Id, fallback?: Field.Value | null) => Field.Value | null
    // Legacy webhook-only `@`-sigil context. Temporary until webhook resolution moves onto Airlock.
    getLegacyExpressionContext: (document: Document, nodeId: Workflow.Node.Id, session?: Execution.Session) => LegacyExpressionContext
    getFields: (document: Document, nodeId: Workflow.Node.Id) => readonly Foundations.Field[]
    getBlueprint: (document: Document, nodeId: Workflow.Node.Id) => Blueprint | null
    getUI: (document: Document, nodeId: Workflow.Node.Id) => NodeUI
    /** The node with its blueprint, resolved fields and ports, and connected inputs; null when it or its blueprint is missing. */
    hydrate: (document: Document, nodeId: Workflow.Node.Id) => Workflow.Node.Hydrated | null
    /** Nodes the run can elect as its entry point. Ids, not objects, so `shallow` holds. */
    getIgniteableNodes: (document: Document) => Workflow.Node.Id[]

    dependency: NodeDependencySelectors
    edges:      NodeEdgeSelectors
    ports:      NodePortSelectors
}

export type NodeUI = {
    displayName: string
    description?: string
    icon: string
    accent?: string
    iconColor?: string
    isMinimized: boolean
    isFlipped: boolean
}

// Neutral UI for a node whose data or blueprint is missing (deleted / not yet hydrated).
const FALLBACK_NODE_UI: NodeUI = {
    displayName: "Unknown Node",
    icon: "OctagonX",
    accent: "node-unknown",
    iconColor: "destructive",
    isMinimized: false,
    isFlipped: false,
}

export interface LegacyExpressionContext {
    node: Workflow.Node.Raw
    fields: Record<Field.Id, unknown>
    incoming: Record<string, unknown>
    globalFields: Record<Field.Id, unknown>
}

export const nodeSelectors: NodeSelectors = {
    get: (d, nodeId) => d.data.nodes[nodeId] ?? null,
    hasIssues: (d, nodeId) => {
        const nodeIssues = d.issues.nodes[nodeId];
        if (!nodeIssues)
            return false;

        return (
            Object.entries(nodeIssues.fields).length > 0 ||
            Object.entries(nodeIssues.inputs).length > 0 ||
            Object.entries(nodeIssues.credentials).length > 0
        );
    },
    isTool: (d, nodeId) => {
        return d.data.staticValues[nodeId]?.["isConvertedToTool" as Field.Id] === true;
    },
    isSourceNode: (d, nodeId) => {
        const incomingEdges = d.cache.incomingEdgesMap[nodeId];
        return incomingEdges ? Object.keys(incomingEdges).length === 0 : true;
    },
    isSinkNode: (d, nodeId) => {
        const outgoingEdges = d.cache.outgoingEdgesMap[nodeId];
        return outgoingEdges ? Object.keys(outgoingEdges).length === 0 : true;
    },
    getStaticValues: (d, nodeId) => d.data.staticValues[nodeId] ?? null,
    getStaticValue: (d, nodeId, id, fallback = null) => d.data.staticValues[nodeId]?.[id] ?? fallback,
    getLegacyExpressionContext: (d, nodeId, session) => ({
        node: d.data.nodes[nodeId],
        fields: d.selectors.field.getValues(d, nodeId),
        incoming: executionSelectors.getNodeIncomingData(d, nodeId, session) ?? {},
        globalFields: Airlock.resolveGlobalFieldValues(d.data),
    }),
    getFields: (d, nodeId) => {
        return d.cache.resolvedShape[nodeId]?.fields ?? [];
    },
    getBlueprint: (d, nodeId) => {
        const node = d.data.nodes[nodeId];
        if (!node)
            return null;

        return d.selectors.blueprint.ofNode(d, node);
    },
    getIgniteableNodes: (d) => {
        return Object.values(d.data.nodes)
            .filter(node => !node.isDisabled)
            .filter(node => d.selectors.node.getBlueprint(d, node.id)?.igniter === true)
            .map(node => node.id);
    },
    getUI: (d, nodeId) => {
        const node = d.data.nodes[nodeId];
        const bp = node ? d.selectors.blueprint.ofNode(d, node) : undefined;
        // The node may have been deleted (stale id) or its blueprint not yet hydrated. Callers
        // render unconditionally, so hand back a neutral placeholder rather than null.
        if (!node || !bp)
            return FALLBACK_NODE_UI;

        // Subworkflow nodes take their identity from the attached dependency record; node-level
        // overrides still win, then the dependency, then the (generic container) blueprint.
        const dep = d.selectors.node.dependency.getShapeValue(d, nodeId);

        return {
            displayName: node?.ui?.displayName ?? dep?.display_name ?? bp.ui.displayName,
            description: node?.ui?.description ?? bp.ui.description,
            icon:        node?.ui?.icon      ?? dep?.icon   ?? bp.ui.icon,
            accent:      node?.ui?.accent    ?? dep?.accent ?? bp.ui.accent,
            iconColor:   node?.ui?.iconColor ?? bp.ui.iconColor,
            isMinimized: node?.ui?.isMinimized ?? false,
            isFlipped:   node?.ui?.isFlipped   ?? false,
        };
    },

    hydrate: (d, nodeId) => {
        const node      = d.data.nodes[nodeId];
        const blueprint = d.selectors.blueprint.forNode(d, nodeId);

        if (!node || !blueprint)
            return null;

        const { addedInputs: _inputs, addedOutputs: _outputs, addedFields: _fields, ...rest } = node;
        const shape = d.cache.resolvedShape[nodeId];

        return {
            ...rest,
            blueprint,
            fields:         shape?.fields  ?? [],
            inputs:         shape?.inputs  ?? [],
            outputs:        shape?.outputs ?? [],
            ui:             d.selectors.node.getUI(d, nodeId),
            connectedPorts: d.selectors.node.ports.getConnected(d, nodeId),
        } as Workflow.Node.Hydrated;
    },

    dependency: nodeDependencySelectors,
    edges:      nodeEdgeSelectors,
    ports:      nodePortSelectors,
}
