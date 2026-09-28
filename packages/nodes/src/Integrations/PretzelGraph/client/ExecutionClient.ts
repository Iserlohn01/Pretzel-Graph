import type { HTTP } from "@pretzel-graph/node-sdk";
import { Execution, ToolView, type Workflow } from "@pretzel-graph/shared/domain";

const SNIPPET_RADIUS = 60;

const NOT_LOADED = "No execution loaded; call execution_load first.";

// Provider bookkeeping on a stored message; never searched.
const SKIPPED_KEYS = new Set(["additional_kwargs", "response_metadata", "usage_metadata", "id"]);

export interface SearchMatch {
    nodeId: Workflow.Node.Id
    run:    number
    portId: string
    side:   "in" | "out"
    path:   string
    snippet: string
}

/**
 * One execution held in memory for reading, so a run's data stays out of the model's context
 * until a tool asks for a part of it. Loading another replaces it; loading the same id again
 * refreshes a run that is still going.
 */
export class ExecutionClient {

    #execution: Execution | null = null;
    #runs:      Record<Workflow.Node.Id, ToolView.Run[]> = {};

    constructor(private readonly http: HTTP.Client) {}

    /** Holds the execution, without its node output instances. */
    public load(execution: Execution): ToolView.ExecutionOverview {
        this.#execution = { ...execution, session: { ...execution.session, node_output_instances: {} } };
        this.#runs      = ToolView.runs(this.#execution);

        return ToolView.execution(this.#execution, this.#runs);
    }

    public async fetch(executionId: Execution.Id): Promise<ToolView.ExecutionOverview> {
        const { execution } = await Execution.API.get(this.http.raw, executionId);

        return this.load(execution);
    }

    public get execution(): Execution {
        if (!this.#execution)
            throw new Error(NOT_LOADED);

        return this.#execution;
    }

    /** Which run a read describes. */
    public get header() {
        return { executionId: this.execution.id, status: this.execution.status };
    }

    public get runs(): Record<Workflow.Node.Id, ToolView.Run[]> {
        if (!this.#execution)
            throw new Error(NOT_LOADED);

        return this.#runs;
    }

    public nodeRuns(nodeId: Workflow.Node.Id): ToolView.Run[] {
        const runs = this.runs[nodeId];

        if (!runs)
            throw new Error(`Node ${nodeId} did not run in this execution`);

        return runs;
    }

    public run(nodeId: Workflow.Node.Id, run: number): ToolView.Run {
        const found = this.nodeRuns(nodeId).find(entry => entry.run === run);

        if (!found)
            throw new Error(`Node ${nodeId} has no run ${run}; it ran ${this.nodeRuns(nodeId).length} time(s)`);

        return found;
    }

    /** Case-insensitive search through every input and output value. */
    public search(text: string, options: { nodeIds?: Workflow.Node.Id[], limit?: number } = {}): SearchMatch[] {
        const needle  = text.toLowerCase();
        const limit   = options.limit ?? 20;
        const nodeIds = options.nodeIds ?? (Object.keys(this.runs) as Workflow.Node.Id[]);
        const matches: SearchMatch[] = [];

        const walk = (value: unknown, path: string[], found: (path: string, snippet: string) => void) => {
            if (typeof value === "string") {
                const at = value.toLowerCase().indexOf(needle);

                if (at >= 0)
                    found(path.join("."), value.slice(Math.max(0, at - SNIPPET_RADIUS), at + needle.length + SNIPPET_RADIUS));

                return;
            }

            if (value && typeof value === "object")
                for (const [key, member] of Object.entries(value))
                    if (!SKIPPED_KEYS.has(key))
                        walk(member, [...path, key], found);
        };

        for (const nodeId of nodeIds)
            for (const run of this.runs[nodeId] ?? [])
                for (const [side, values] of [["in", run.inputs], ["out", run.outputs]] as const)
                    for (const [portId, value] of Object.entries(values))
                        walk(value, [], (path, snippet) => {
                            if (matches.length < limit)
                                matches.push({ nodeId, run: run.run, portId, side, path, snippet });
                        });

        return matches;
    }
}
