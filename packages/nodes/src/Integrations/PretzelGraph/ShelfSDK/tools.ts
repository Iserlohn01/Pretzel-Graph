import { tool } from "@langchain/core/tools";
import { ToolBudget, type HTTP } from "@pretzel-graph/node-sdk";
import { Foundations, Shelf, ToolView } from "@pretzel-graph/shared/domain";
import { z } from "zod/v3";


const PORT_VARIANTS = Foundations.Port.Variant.options as [string, ...string[]];

const strings = z.array(z.string()).optional();


export function buildTools(api: HTTP.Client) {

    const queryBlueprints = tool(
        async (query) => {
            const { items, total } = await Shelf.API.Internal.query(api.raw, query as never);

            return ToolBudget.list("blueprints", items, { hint: total > items.length ? `${total} matched; ${items.length} returned. Narrow the query or raise limit.` : undefined });
        },
        {
            name:        "shelf_query_blueprints",
            description: "Find blueprints that can be placed on a workflow. Filters combine; omit all to list everything. Each result has the id, name, description, drawer, capabilities, field ids and port kinds; use shelf_get_blueprint for the full shape. fieldIds leave out the fields every node has (signalDependency, dataDependency, onErrorStrategy, ignition_policy). Field and port filters match the base shape only, not what a derivative branch adds. Read-only.",
            schema: z.object({
                ids:             strings.describe("Only these blueprint ids."),
                displayName:     z.string().optional().describe("Case-insensitive substring of the display name."),
                drawerIds:       strings.describe("Only blueprints in these shelf drawers."),
                toolCompatible:  z.boolean().optional().describe("Can be handed to an agent as tools."),
                proxyCompatible: z.boolean().optional().describe("Can route its network traffic through a proxy credential."),
                isDerivable:     z.boolean().optional().describe("Some field values reshape the node's ports."),
                isIgniter:       z.boolean().optional().describe("Starts a run only when the run is started via it: webhooks and connection events."),
                fieldIds:        strings.describe("Has every one of these fields."),
                inputVariants:   z.array(z.enum(PORT_VARIANTS)).optional().describe("Has an input port of any of these kinds."),
                outputVariants:  z.array(z.enum(PORT_VARIANTS)).optional().describe("Has an output port of any of these kinds."),
                limit:           z.number().int().positive().max(500).optional().describe("Default 50."),
            }),
        },
    );


    const getBlueprint = tool(
        async ({ blueprintId }) => {
            const { blueprint } = await Shelf.API.Internal.get(api.raw, blueprintId as Foundations.Blueprint.Id);

            return ToolBudget.value(ToolView.blueprint(blueprint));
        },
        {
            name:        "shelf_get_blueprint",
            description: "Get a blueprint's base shape: its description, fields, input ports, output ports and the credential templates its node takes. A field marked reconcile reshapes the node when set. When isDerivable, derivativeBranches lists every way the node can be reshaped: each path is the field values that select a branch, with the fields, ports and credential templates it adds and any base members it replaces; a repeating field appears once, as <fieldId>==<count>. Reach a branch by setting those fields with field.set in workbench_apply. isIgniter means a run must be started via this node; webhookRoute means it receives HTTP requests; connectionField names the field holding the connection it listens on. frameworkFields holds the fields every node has, with their initial values: signalDependency (AND, OR, XOR), dataDependency (AND, OR), onErrorStrategy (terminate, propagate, do_nothing) and, on igniters, ignition_policy (every_event, drop_while_running); set them with field.set like any other field. Read-only.",
            schema:      z.object({ blueprintId: z.string() }),
        },
    );


    return [queryBlueprints, getBlueprint];
}
