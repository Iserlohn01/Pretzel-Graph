import { Workflow } from "@pretzel-graph/shared/domain/Workflow";
import { Vertex } from "../../S2/graph";
import { Port } from "@pretzel-graph/shared/domain/Foundations/Port";
import { Field } from "@pretzel-graph/shared/domain/Foundations/Field";
import { Blueprint } from "@pretzel-graph/shared/domain/Foundations/Blueprint";
import { Execution } from "@pretzel-graph/shared/domain";
import { SystemError } from "@pretzel-graph/shared/domain/SystemError";
import { RuntimeNode } from "@pretzel-graph/node-sdk";
import { AggexExecutionError, UncaughtRuntimeNodeError, CyclicalRuntimeNodeError } from "src/errors";
import { AirlockTerminationError } from "src/airlock";
import { System } from "@pretzel-graph/shared/system";
import type { AggexEngine } from "../index";
import { frameworkFields } from "../framework-fields";
import { ExecutionContext } from "../execution-context";

/**
 * Error handling across the graph: records failures, applies each node's
 * `onErrorStrategy`, and routes out-of-band error envelopes along edges
 * (propagate / catch / terminate). The envelope channel lives on `ctx.errorChannel`.
 */
export class ErrorService {

    private readonly log = System.log.withContext("Errors");

    constructor(private engine: AggexEngine) {}

    private get ctx(): ExecutionContext { return this.engine.ctx; }

    /**
     * A node's own execution threw. Branch on its `onErrorStrategy` field:
     *   - `terminate` (default) → re-throw so S2 rejects the whole run (`onNodeError` records it).
     *   - `do_nothing`          → record + emit, fire nobody (downstream stalls). Partial run.
     *   - `propagate`           → record + emit, then send an error envelope down every outgoing edge.
     */
    public handle(
        vertexId: Vertex.Id,
        error:    unknown,
    ): Set<Vertex.Id> | void {
        const entry = this.ctx.nodeRuntimeMap.get(vertexId);
        const nodeId = vertexId as unknown as Workflow.Node.Id;

        const aggexError = error instanceof SystemError
            ? error
            : new AggexExecutionError(
                SystemError.Code.EXECUTION_NODE_FAILED,
                error instanceof Error ? error.message : String(error),
            );

        // OOM disposed the shared airlock isolate — it's unrecoverable and every scope is
        // dead. Force-terminate regardless of the node's onErrorStrategy (do_nothing/propagate
        // would just cascade the same failure into every subsequent node).
        if (error instanceof AirlockTerminationError)
            throw aggexError;

        // Framework fields live on every arm of InferFieldValues, but a union can't be indexed by a
        // dynamic key — read them through a plain record.
        const strategy = frameworkFields(entry?.instance)["onErrorStrategy" as Field.Id] ?? "terminate";

        switch (strategy) {
            case "terminate": {
                throw aggexError;
            }
            case "do_nothing":
                this.log.warning("node failed; swallowed (onErrorStrategy=do_nothing)", {
                    nodeId,
                    error: aggexError.message,
                });
                this.record(nodeId, aggexError.toJSON());
                return new Set<Vertex.Id>();   // fire nobody
            default:
            case "propagate":
                const envelope: AggexEngine.Execution.ErrorEnvelope = {
                    id:    crypto.randomUUID(),
                    error: aggexError.toJSON(),
                    path:  [],
                };
                return this.propagate(vertexId, envelope);
        }
    }


    /**
     * Interception in the execute hook: if an error envelope sits on an incoming edge,
     * this node does NOT run its own logic — it either catches (Catch node →
     * materialize to `onError`) or re-propagates. Returns the targets to fire, or
     * `undefined` when there is no envelope (caller proceeds normally).
     */
    public interceptIncoming(
        vertexId: Vertex.Id,
        instance: RuntimeNode<Blueprint>,
    ): Set<Vertex.Id> | undefined {
        const incomingEnvelope = this.findIncomingEnvelope(vertexId);
        if (!incomingEnvelope) return undefined;

        this.consumeIncomingEnvelopes(vertexId);   // delivered — clear from channel

        if (instance.CATCHES_ERROR === true)
            return this.materializeCaught(vertexId, incomingEnvelope);

        return this.propagate(vertexId, incomingEnvelope);
    }


    /** First error envelope sitting on any of this node's incoming edges, if any. */
    public findIncomingEnvelope(
        vertexId: Vertex.Id,
    ): AggexEngine.Execution.ErrorEnvelope | undefined {
        const incoming = this.ctx.workflowCache.inputEdgesByPort[vertexId as unknown as Workflow.Node.Id];
        if (!incoming) return undefined;

        for (const edgeId of Object.values(incoming)) {
            const envelope = this.ctx.errorChannel.get(edgeId);
            if (envelope) return envelope;
        }
        return undefined;
    }


    /** Records a node as `failed` to both lifecycle observers (recording + session).
     *  Shared by the engine's S2 error hook (terminate) and the inline strategy
     *  handler (do_nothing/propagate). */
    public record(
        nodeId: Workflow.Node.Id,
        error:  SystemError.Serialized,
    ) {
        this.engine.flightRecorder?.onNodeFailed(nodeId, error);
        this.engine.services.session.onNodeFailed(nodeId, error);
    }


    /**
     * Send `envelope` down every wired outgoing edge of this node and fire those
     * targets. Used both at the origin (fresh envelope) and for pass-through nodes
     * re-emitting a received envelope. Returns the set of target vertices to fire
     * (router-style); the carrying node is recorded `failed` so the path lights up.
     *
     * Throws (→ terminate) when:
     *   - the envelope's `path` already contains this node → `CyclicalRuntimeNodeError`
     *   - this node has no wired outgoing edges → `UncaughtRuntimeNodeError`
     */
    private propagate(
        vertexId: Vertex.Id,
        envelope: AggexEngine.Execution.ErrorEnvelope,
    ): Set<Vertex.Id> {
        const nodeId = vertexId as unknown as Workflow.Node.Id;

        // Cycle: the error looped back onto a node already in its own path.
        if (envelope.path.includes(nodeId))
            throw new CyclicalRuntimeNodeError(
                `Error cycled back onto node "${nodeId}": ${envelope.error.message}`,
                [...envelope.path, nodeId] as unknown as string[],
            );

        const outgoing = this.ctx.workflowCache.outgoingEdgesMap[nodeId];
        const wiredEdgeIds = outgoing ? Object.values(outgoing) : [];

        // Terminal: nowhere left to forward → the error was never caught.
        if (wiredEdgeIds.length === 0)
            throw new UncaughtRuntimeNodeError(
                `Uncaught node error reached terminal node "${nodeId}": ${envelope.error.message}`,
                [...envelope.path, nodeId] as unknown as string[],
            );

        // This node is now carrying the error.
        this.record(nodeId, envelope.error);

        const nextEnvelope: AggexEngine.Execution.ErrorEnvelope = {
            ...envelope,
            path: [...envelope.path, nodeId],
        };

        const edgeIdMap: Record<string, Workflow.Edge.Id> = {};
        const targets = new Set<Vertex.Id>();

        for (const edgeId of wiredEdgeIds) {
            this.ctx.errorChannel.set(edgeId, nextEnvelope);
            edgeIdMap[edgeId] = edgeId;
            const edge = this.ctx.workflowCache.edges[edgeId];
            if (edge)
                targets.add(edge.target.nodeId as unknown as Vertex.Id);
        }

        const edgeStateUpdate = this.engine.services.session.createEdgeStateUpdate(
            edgeIdMap, "waiting", s => { s.runCount += 1; },
        );

        this.ctx.realtimeAPI.emit(Execution.Event.create("session:patch", {
            sessionPatch: { upsert: { edge_state: edgeStateUpdate } },
        }));

        return targets;   // fireVertexDependents fires only these
    }


    /**
     * A Catch node received an error envelope: materialize the serialized error onto
     * its `onError` output port (so downstream gets it as `Data`) and fire only that
     * branch. The envelope was already consumed from the channel, so propagation
     * stops here. The node completes normally (it succeeded at catching).
     */
    private materializeCaught(
        vertexId: Vertex.Id,
        envelope: AggexEngine.Execution.ErrorEnvelope,
    ): Set<Vertex.Id> {
        const nodeId = vertexId as unknown as Workflow.Node.Id;
        const onErrorPort = "onError" as Port.Output.Id;

        this.engine.services.nodeIO.writePort(nodeId, onErrorPort, envelope.error);

        return this.engine.services.routing.resolveRouterSignals(nodeId, { [onErrorPort]: envelope.error });
    }


    /** Remove delivered envelopes from this node's incoming edges. */
    private consumeIncomingEnvelopes(
        vertexId: Vertex.Id,
    ): void {
        const incoming = this.ctx.workflowCache.inputEdgesByPort[vertexId as unknown as Workflow.Node.Id];
        if (!incoming) return;

        for (const edgeId of Object.values(incoming))
            this.ctx.errorChannel.delete(edgeId);
    }
}
