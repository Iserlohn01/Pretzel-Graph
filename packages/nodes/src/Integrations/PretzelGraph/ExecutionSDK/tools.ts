import { tool } from "@langchain/core/tools";
import { ToolBudget, type HTTP } from "@pretzel-graph/node-sdk";
import { Execution, ToolView, type Workflow } from "@pretzel-graph/shared/domain";
import { z } from "zod/v3";

import { ExecutionClient } from "../client";



const executionId = z.string();

// Request config that disables retries for run requests.
export const NO_RETRY: HTTP.RequestConfig = { retryable: () => false };


export function buildTools(api: HTTP.Client) {

    const client = new ExecutionClient(api);

    const runSchema = {
        workflowId:  z.string(),
        message:     z.string().optional().describe("Start the run as a chat message to the workflow. Omitted, the run starts as a manual one."),
        chatId:      z.string().optional().describe("With message: an existing chat to continue. Omitted, a new chat starts."),
        viaNodeId:   z.string().optional().describe("Start the run via this igniter node (a Webhook or Events node). It then waits, until its test timeout, for a real request or event the user sends."),
        record:      z.boolean().optional().describe("Record every firing of every node, default true. The execution_ read tools see each run of a node only when recorded."),
    };

    const timeoutSeconds = z.number().int().positive().max(600).optional()
        .describe("Seconds to hold for, default 300. Past it the run is returned as it stands, with settled false, and keeps going.");

    const OVERVIEW = "Returns the run's overview (status, duration, node and run counts, every error with its node and run) and loads the run for execution_query_nodes, execution_get_node, execution_read and execution_search.";

    const RUN_NOTE = "Without viaNodeId or message the run is manual, and igniter nodes don't start. Fails if the workflow has validation issues or nodes whose blueprints no longer exist.";

    const igniterOptions = (args: { message?: string, chatId?: string, viaNodeId?: string, record?: boolean }): Execution.BuildIgniterOptions => {
        if (args.viaNodeId !== undefined)
            return { variant: "via", nodeId: args.viaNodeId as Workflow.Node.Id, record: args.record ?? true };

        if (args.message !== undefined)
            return { variant: "chat", message: args.message, chatId: args.chatId as never, record: args.record ?? true };

        return { variant: "manual", record: args.record ?? true };
    };

    const start = (args: { workflowId: string, message?: string, chatId?: string, viaNodeId?: string, record?: boolean }, wait?: { timeoutMs: number }) =>
        Execution.API.run(api.raw, args.workflowId as never, {
            igniter:     Execution.buildIgniter(igniterOptions(args)),
            await: wait,
        }, NO_RETRY);

    const run = tool(
        async (args) => {
            const { execution } = await start(args);

            return ToolBudget.value({ executionId: execution.id, status: execution.status });
        },
        {
            name:        "execution_run",
            description: `Start a run of a workflow and return once it has been picked up, with its id and status pending. Follow it with execution_wait or execution_load. ${RUN_NOTE}`,
            schema:      z.object(runSchema),
        },
    );


    const runAndAwait = tool(
        async ({ timeoutSeconds, ...args }) => {
            const { execution, settled } = await start(args, { timeoutMs: (timeoutSeconds ?? 300) * 1_000 });

            return ToolBudget.value({ ...client.load(execution), settled: settled ?? false });
        },
        {
            name:        "execution_run_and_await",
            description: `Start a run of a workflow and hold until it settles, with settled true, or until the timeout, with settled false. ${OVERVIEW} ${RUN_NOTE}`,
            schema:      z.object({ ...runSchema, timeoutSeconds }),
        },
    );


    const wait = tool(
        async ({ executionId, timeoutSeconds }) => {
            const { execution, settled } = await Execution.API.wait(api.raw, executionId as Execution.Id, { timeoutMs: (timeoutSeconds ?? 300) * 1_000 });

            return ToolBudget.value({ ...client.load(execution), settled });
        },
        {
            name:        "execution_wait",
            description: `Hold until an execution completes, fails or is terminated, with settled true, or until the timeout, with settled false. Safe to call on one that already has. ${OVERVIEW}`,
            schema:      z.object({ executionId, timeoutSeconds }),
        },
    );


    const signal = (name: string, description: string, send: (id: Execution.Id) => Promise<{ success: boolean }>) => tool(
        async ({ executionId }) => ToolBudget.value(await send(executionId as Execution.Id)),
        { name, description, schema: z.object({ executionId }) },
    );

    const pause     = signal("execution_pause",     "Pause a running execution. A run left paused for 5 minutes is terminated. Returns whether the run took the signal.", id => Execution.API.pause(api.raw, id));
    const resume    = signal("execution_resume",    "Resume a paused execution. Returns whether the run took the signal.",                                                id => Execution.API.resume(api.raw, id));
    const terminate = signal("execution_terminate", "Stop an execution for good. Returns whether the run took the signal.",                                               id => Execution.API.terminate(api.raw, id));


    const load = tool(
        async ({ executionId }) => ToolBudget.value(await client.fetch(executionId as Execution.Id)),
        {
            name:        "execution_load",
            description: `Load an execution to read it, replacing the one loaded before; load the same id again to refresh a run still going. ${OVERVIEW} Read-only.`,
            schema:      z.object({ executionId }),
        },
    );


    const queryNodes = tool(
        async ({ status, failed, blueprintIds, limit }) => {
            const blueprints = blueprintIds && new Set(blueprintIds);

            const nodes = Object.entries(client.runs)
                .filter(([nodeId]) => !blueprints || [...blueprints].some(id => nodeId.startsWith(`${id}-`)))
                .map(([nodeId, runs]) => ({
                    nodeId,
                    runs:       runs.length,
                    lastStatus: runs[runs.length - 1].status,
                    totalMs:    runs.reduce((sum, run) => sum + (run.durationMs ?? 0), 0),
                    ...(runs.some(run => run.error) ? { failedRuns: runs.filter(run => run.error).map(run => run.run) } : {}),
                }))
                .filter(node => !status || node.lastStatus === status)
                .filter(node => failed === undefined || !!node.failedRuns === failed);

            return ToolBudget.value({ ...client.header, total: nodes.length, nodes: nodes.slice(0, limit ?? 50) });
        },
        {
            name:        "execution_query_nodes",
            description: "List the loaded execution's nodes that ran: how many times each fired, the last run's status, total time, and which runs failed. Filters combine. Read-only.",
            schema:      z.object({
                status:       z.enum(["running", "completed", "failed", "waiting"]).optional().describe("The last run's status."),
                failed:       z.boolean().optional().describe("Has a failed run."),
                blueprintIds: z.array(z.string()).optional(),
                limit:        z.number().int().positive().max(200).optional().describe("Default 50."),
            }),
        },
    );


    const getNode = tool(
        async ({ nodeId, runs }) => ToolBudget.value({ ...client.header, nodeId, ...ToolView.executionNode(client.nodeRuns(nodeId as Workflow.Node.Id), runs) }),
        {
            name:        "execution_get_node",
            description: "One node's runs in the loaded execution: each run's status, timing, the runs that triggered it (triggeredBy, as nodeId#run) or whose earlier output it read (readFrom), its error, and the shape of each input and output. Values are not included; read one with execution_read. More than 10 runs show the first 3 and last 5; ask for a range with runs. Read-only.",
            schema:      z.object({
                nodeId: z.string(),
                runs:   z.string().regex(/^\d+(-\d+)?$/).optional().describe("A run or range, e.g. \"4\" or \"4-9\"."),
            }),
        },
    );


    const read = tool(
        async ({ nodeId, run, portId, side, path, offset, limit }) => {
            const entry  = client.run(nodeId as Workflow.Node.Id, run);
            const values = (side ?? "out") === "out" ? entry.outputs : entry.inputs;

            if (!(portId in values))
                throw new Error(`Run ${run} of ${nodeId} has no ${side ?? "out"} port ${portId}; it has ${Object.keys(values).join(", ") || "none"}`);

            return ToolBudget.value({ ...client.header, nodeId, run, portId, ...ToolView.page(values[portId], { path, offset, limit }) });
        },
        {
            name:        "execution_read",
            description: "Read one input or output value of one run in the loaded execution. path drills in (\"3.content\", \"0.tool_calls.0.args\"); a list returns limit items from offset (default 10), text returns limit characters from offset (default 4000). Messages come without provider metadata. Read-only.",
            schema:      z.object({
                nodeId: z.string(),
                run:    z.number().int().positive(),
                portId: z.string(),
                side:   z.enum(["in", "out"]).optional().describe("Default out."),
                path:   z.string().optional(),
                offset: z.number().int().min(0).optional(),
                limit:  z.number().int().positive().max(20_000).optional(),
            }),
        },
    );


    const search = tool(
        async ({ text, nodeIds, limit }) => ToolBudget.value({ ...client.header, matches: client.search(text, { nodeIds: nodeIds as Workflow.Node.Id[] | undefined, limit }) }),
        {
            name:        "execution_search",
            description: "Find text in every input and output value of the loaded execution, case-insensitive. Each match names the node, run, port, side and path, with a snippet; read the value with execution_read. Read-only.",
            schema:      z.object({
                text:    z.string().min(1),
                nodeIds: z.array(z.string()).optional(),
                limit:   z.number().int().positive().max(100).optional().describe("Default 20."),
            }),
        },
    );


    return [run, runAndAwait, wait, load, queryNodes, getNode, read, search, pause, resume, terminate];
}
