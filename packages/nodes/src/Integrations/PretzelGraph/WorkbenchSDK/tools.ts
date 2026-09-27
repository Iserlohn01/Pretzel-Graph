import { tool } from "@langchain/core/tools";
import { ToolBudget } from "@pretzel-graph/node-sdk";
import { Foundations, ToolView, Workbench, type Workflow } from "@pretzel-graph/shared/domain";
import { z } from "zod/v3";

import type { WorkbenchClient } from "../client";


// Schemas are factories so each use is inlined instead of becoming a $ref to its first use.
const nodeId       = () => z.string();
const position     = () => z.object({ x: z.number(), y: z.number() });
const identifier   = () => z.string().regex(Workbench.ID_PATTERN, "Letters, digits and underscores only.");

const globalFieldSpec = () => ({
    displayName:  z.string(),
    variant:      z.enum(["String", "Boolean", "Integer", "Float"]),
    required:     z.boolean().optional(),
    tooltip:      z.string().optional(),
    initialValue: z.union([z.string(), z.number(), z.boolean()]).optional(),
    min:          z.number().optional().describe("Integer and Float only."),
    max:          z.number().optional().describe("Integer and Float only."),
    multiline:    z.boolean().optional().describe("String only."),
});
const globalFieldPatch = () => z.object(globalFieldSpec()).partial().extend({
    tooltip: z.string().nullable().optional().describe("Null clears it."),
    min:     z.number().nullable().optional().describe("Integer and Float only. Null clears it."),
    max:     z.number().nullable().optional().describe("Integer and Float only. Null clears it."),
});

const PORT_VARIANTS = Foundations.Port.Variant.options.filter(v => !Foundations.Port.isUnresolvedLike(v)) as [string, ...string[]];

const inputPort = () => z.object({
    id:          identifier(),
    displayName: z.string(),
    variant:     z.enum(PORT_VARIANTS),
    required:    z.boolean().optional(),
});

const edgeEndpoints = {
    sourceNodeId: z.string(),
    sourcePortId: z.string(),
    targetNodeId: z.string(),
    targetPortId: z.string(),
};

const operation = z.discriminatedUnion("op", [
    z.object({
        op:           z.literal("node.create"),
        blueprintId:  z.string(),
        position:     position().optional().describe("Omit to place right of the rightmost node."),
        staticValues: z.record(z.unknown()).optional()
            .describe("Keyed by field id or input port id. Reconcile fields are rejected; set them with a field.set operation. A field that starts in expression mode takes one JavaScript expression, e.g. $igniter.chat_id or `Event: ${JSON.stringify($in.event)}`; never {{ }}."),
    }).describe("Add a node. Returns its id with its fields, ports, modes and issues, as workbench_get_node does; the id can't be referenced in the same call."),

    z.object({ op: z.literal("node.delete"), nodeId: nodeId() })
        .describe("Remove a node and its edges."),

    z.object({ op: z.literal("node.move"), nodeId: nodeId(), position: position() })
        .describe("Move a node on the canvas."),

    z.object({ op: z.literal("node.addInputPort"), nodeId: nodeId(), port: inputPort() })
        .describe("Add an extra input port. Not for sub-workflow nodes."),

    z.object({ op: z.literal("node.removeInputPort"), nodeId: nodeId(), portId: z.string() })
        .describe("Remove an added input port and its edge. Blueprint ports can't be removed."),

    z.object({ op: z.literal("node.updateInputPort"), nodeId: nodeId(), portId: z.string(), port: inputPort() })
        .describe("Change an added input port. Blueprint ports can't be edited."),

    z.object({ op: z.literal("edge.create"), ...edgeEndpoints })
        .describe("Connect an output port to an input port. An input takes one edge."),

    z.object({ op: z.literal("edge.delete"), edgeId: z.string() })
        .describe("Remove an edge."),

    z.object({
        op:      z.literal("field.set"),
        nodeId:  nodeId(),
        fieldId: z.string(),
        value:   z.unknown()
            .describe("Same shape as the field's value in workbench_get_node. In expression mode, one JavaScript expression as a string, e.g. $igniter.chat_id or `Event: ${JSON.stringify($in.event)}`; never {{ }}. Not type-checked here."),
        mode:    z.enum(["static", "expression"]).optional().describe("Omit to keep the current mode."),
    }).describe("Set a field's value, optionally switching its mode. A reshaping field returns the ports added and removed and the edges dropped."),

    z.object({
        op:         z.literal("credential.setInstance"),
        nodeId:     nodeId(),
        templateId: z.string().describe("From credentials on workbench_get_node."),
        instanceId: z.string().nullable().describe("From vault_list_credential_instances. Null detaches."),
    }).describe("Attach a credential instance for one of the node's templates. Returns the node's remaining issues."),

    z.object({ op: z.literal("globalField.add"), id: identifier(), ...globalFieldSpec() })
        .describe("Add a global field: an input the workflow exposes when used as a sub-workflow node, read inside it as $globalFields.<id>."),

    z.object({ op: z.literal("globalField.update"), fieldId: z.string(), patch: globalFieldPatch() })
        .describe("Change a global field. Only the given properties change. Changing the kind resets the default, limits and multiline unless the patch sets them."),

    z.object({ op: z.literal("globalField.remove"), fieldId: z.string() })
        .describe("Remove a global field."),
]);

const toConnection = (edge: z.infer<z.ZodObject<typeof edgeEndpoints>>): Workbench.Document.DriverConnection => ({
    source:       edge.sourceNodeId as Workflow.Node.Id,
    sourceHandle: edge.sourcePortId as Foundations.Port.Output.Id,
    target:       edge.targetNodeId as Workflow.Node.Id,
    targetHandle: edge.targetPortId as Foundations.Port.Input.Id,
});

type BatchResult = Awaited<ReturnType<WorkbenchClient["operations"]["batch"]>>;

// A node as a model reads it; null once a later operation removed it.
const readNode = (client: WorkbenchClient, nodeId: Workflow.Node.Id): ToolView.Node | null => {
    try {
        return ToolView.node(client.operations.document, nodeId);
    }
    catch {
        return null;
    }
};

// Each result as a model reads it: a created node in full, a reshape with the fields it left, issues by type.
const summarizeResult = (client: WorkbenchClient, op: Workbench.Operation, result: unknown): unknown => {
    if (!result || typeof result !== "object")
        return result;

    const { issues, derivation, ...rest } = result as Record<string, unknown> & { nodeId?: Workflow.Node.Id };

    if (op.op === "node.create")
        return { nodeId: rest.nodeId, node: readNode(client, rest.nodeId as Workflow.Node.Id) };

    return {
        ...rest,
        ...(issues !== undefined ? { issues: ToolView.issues(issues as never) } : {}),
        ...(derivation ? { derivation, fields: readNode(client, rest.nodeId as Workflow.Node.Id)?.fields } : {}),
    };
};

const summarizeBatch = (client: WorkbenchClient, operations: Workbench.Operation[], batch: BatchResult) => ({
    ...batch,
    results: batch.results.map((result, index) => summarizeResult(client, operations[index], result)),
});


export function buildTools(client: WorkbenchClient) {

    const nodeIds = () => z.array(z.string()).optional();

    const queryNodes = tool(
        async (query) => {
            const { items, total } = client.operations.workflow.queryNodes(query as never);

            return ToolBudget.list("nodes", items, { hint: total > items.length ? `${total} matched; ${items.length} returned. Narrow the query or raise limit.` : undefined });
        },
        {
            name:        "workbench_query_nodes",
            description: `Find nodes. Filters combine; omit all to list every node. Returns id, blueprint, display name, disabled flag and whether the node has validation issues; use workbench_get_node for detail. Read-only.`,
            schema: z.object({
                ids:          nodeIds().describe("Only these node ids."),
                blueprintIds: z.array(z.string()).optional().describe("Only nodes of these blueprints."),
                displayName:  z.string().optional().describe("Case-insensitive substring of the display name."),
                upstreamOf:   nodeIds().describe("Only nodes that feed directly into any of these nodes."),
                downstreamOf: nodeIds().describe("Only nodes fed directly by any of these nodes."),
                limit:        z.number().int().positive().max(500).optional().describe("Default 50."),
            }),
        },
    );


    const queryEdges = tool(
        async (query) => {
            const { items, total } = client.operations.workflow.queryEdges(query as never);

            return ToolBudget.list("edges", items, { hint: total > items.length ? `${total} matched; ${items.length} returned. Narrow the query or raise limit.` : undefined });
        },
        {
            name:        "workbench_query_edges",
            description: "Find edges. Filters combine; omit all to list every edge. Each edge has an id and its source and target node and port. Read-only.",
            schema: z.object({
                nodeIds:       nodeIds().describe("Edges touching any of these nodes at either end."),
                sourceNodeIds: nodeIds().describe("Edges leaving any of these nodes."),
                targetNodeIds: nodeIds().describe("Edges entering any of these nodes."),
                limit:         z.number().int().positive().max(500).optional().describe("Default 50."),
            }),
        },
    );


    const getMeta = tool(
        async () => ToolBudget.value(await client.getMeta()),
        {
            name:        "workbench_get_workflow_meta",
            description: "Get the workflow's name, description, icon, folder, lock state and timestamps. Not its graph. Read-only.",
            schema:      z.object({}),
        },
    );


    const getLayout = tool(
        async () => ToolBudget.value(client.operations.workflow.layout()),
        {
            name:        "workbench_get_layout",
            description: "Get every node's canvas position and estimated size, plus the bounding box of the whole graph. Use it to place or move nodes without overlap. Read-only.",
            schema:      z.object({}),
        },
    );


    const getNode = tool(
        async ({ nodeId }) => ToolBudget.value(ToolView.node(client.operations.document, nodeId as Workflow.Node.Id)),
        {
            name:        "workbench_get_node",
            description: `Get one node: its blueprint, fields with each one's mode (static or expression; switchable false when it can't change), ports, current values, the credential templates it takes with the instance attached to each, validation issues by type, and the edge ids on each port (an edge id reads source|port|target|port). frameworkFields holds the fields every node has: signalDependency (AND, OR, XOR), dataDependency (AND, OR), onErrorStrategy (terminate, propagate, do_nothing) and, on igniters, ignition_policy (every_event, drop_while_running); set them with field.set like any other field. Read-only.`,
            schema:      z.object({ nodeId: nodeId() }),
        },
    );


    const listGlobalFields = tool(
        async () => ToolBudget.list("fields", client.operations.globalField.list()),
        {
            name:        "workbench_list_global_fields",
            description: "List the workflow's global fields. Read-only.",
            schema:      z.object({}),
        },
    );


    const apply = tool(
        async ({ operations }) => {
            const mapped = operations.map(op => op.op === "edge.create" ? { op: op.op, ...toConnection(op) } : op);

            if (!client.inTransaction)
                return "No open transaction; call workbench_begin_transaction first.";

            const batch = await client.operations.batch(mapped as Workbench.Operation[]);

            return ToolBudget.value(summarizeBatch(client, mapped as Workbench.Operation[], batch));
        },
        {
            name:        "workbench_apply",
            description: "Edit the workflow inside an open transaction: run operations in order. Stops at the first failure, with the reason under failed; earlier operations stay applied and their results are returned.",
            schema:      z.object({ operations: z.array(operation).min(1) }),
        },
    );


    const begin = tool(
        async () => {
            if (client.inTransaction)
                return "A transaction is already open.";

            await client.ensureTransaction();
            return "Transaction open. Reads now show the saved graph.";
        },
        {
            name:        "workbench_begin_transaction",
            description: "Hold the workflow for editing and reload it from the saved graph. No one else can save it until you commit or roll back. Fails if someone else holds it.",
            schema:      z.object({}),
        },
    );


    const commit = tool(
        async () => {
            if (!client.inTransaction)
                return "Nothing to save.";

            await client.commitTransaction();
            return "Saved.";
        },
        {
            name:        "workbench_commit_transaction",
            description: "Save the transaction's changes and release the workflow. Commit before your final answer: a transaction left open is rolled back after you answer.",
            schema:      z.object({}),
        },
    );


    const rollback = tool(
        async () => {
            if (!client.inTransaction)
                return "Nothing to roll back.";

            await client.abortTransaction();
            return "Rolled back.";
        },
        {
            name:        "workbench_rollback_transaction",
            description: "Throw away the transaction's changes and release the workflow. Reads go back to the saved graph.",
            schema:      z.object({}),
        },
    );


    return [
        getMeta, queryNodes, queryEdges, getNode, getLayout, listGlobalFields,
        begin, apply, commit, rollback,
    ];
}
