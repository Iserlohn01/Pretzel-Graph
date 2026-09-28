import { Execution, type SystemError } from "@pretzel-graph/shared/domain"
import { Workflow } from "@pretzel-graph/shared/domain/Workflow"
import { Port } from "@pretzel-graph/shared/domain/Foundations/Port"
import { Vertex } from "../../S2/graph"
import type { ExecutionContext } from "../execution-context"

export class FlightRecorderService {

    private readonly executionId: Execution.Id
    private readonly workflowId:  Workflow.Id
    private readonly origin:      number

    private recording!:    Execution.Recording
    private mostRecentUoW: Map<Workflow.Node.Id, Execution.Recording.UnitOfWork.Id> = new Map()
    private uowInputs:     Map<Execution.Recording.UnitOfWork.Id, Record<string, unknown>> = new Map()

    constructor(
        private readonly ctx: ExecutionContext,
        origin:               number,  // performance.now() at execution start
    ) {
        const workflowData = ctx.workflowData

        this.executionId = ctx.executionId
        this.workflowId  = ctx.workflowId
        this.origin      = origin

        this.recording = {
            workflowDataSnapshot: workflowData,
            units:                {},
            relations:            {},
            tracks:               {},
            dataBank:             { snapshots: {} },
        }
        Object.values(workflowData.nodes).forEach(node => {
            this.recording.tracks[node.id] = {
                id:      node.id,
                unitIds: [],
            }
        })
    }



    // Called from AggexEngine.onNodeFired.
    // Creates a new UnitOfWork for the node, appends it to the track.
    public onNodeFired(nodeId: Workflow.Node.Id): void {
        const unitId    = Execution.Recording.UnitOfWork.createId(nodeId)
        const startedAt = performance.now() - this.origin

        const unit: Execution.Recording.UnitOfWork = {
            id:             unitId,
            trackId:        nodeId,
            status:         "running",
            startedAt,
            inputSnapshot:  {},
            outputSnapshot: {},
            metrics:        {},
        }

        this.recording.units[unitId] = unit
        this.recording.tracks[nodeId].unitIds.push(unitId)
        this.mostRecentUoW.set(nodeId, unitId)
    }



    // Called from AggexEngine.onNodeExecuted (has the signals set).
    // Detects signal vs dataRemnant relations by comparing signals against allDeps.
    // Populates inputSnapshot by pointing to the source UoW's DataBank entries.
    public onNodeExecuted(
        nodeId:  Workflow.Node.Id,
        signals: Set<Workflow.Node.Id | Vertex.Id>,
        allDeps: Set<Vertex.Id>,
        inputs:  Record<string, unknown>,
        fields:  Record<string, unknown>,
    ): void {
        const unitId = this.mostRecentUoW.get(nodeId)
        if (!unitId) return

        const unit = this.recording.units[unitId]
        if (!unit) return

        this.uowInputs.set(unitId, inputs)
        unit.fieldSnapshot = fields

        const inputEdges = this.ctx.workflowCache.inputEdgesByPort[nodeId] ?? {}

        this.ctx.realtimeAPI.emit(Execution.Event.create("unit:started", { unit }))

        const incomingRelations: Execution.Recording.Relation[] = []

        for (const [portIdStr, edgeId] of Object.entries(inputEdges)) {
            const portId = portIdStr as Port.Input.Id
            const edge   = this.ctx.workflowCache.edges[edgeId]
            if (!edge) continue

            const sourceNodeId  = edge.source.nodeId
            const sigSet        = signals as Set<string>
            const depSet        = allDeps  as Set<string>
            const isSignal      = sigSet.has(sourceNodeId)
            const isDataRemnant = !isSignal && depSet.has(sourceNodeId)

            if (!isSignal && !isDataRemnant) continue

            const sourceUoWId = this.mostRecentUoW.get(sourceNodeId)
            if (!sourceUoWId) continue

            const snapshotId = Execution.Recording.DataBank.PortSnapshot.formatId(sourceUoWId, edge.source.portId)
            unit.inputSnapshot[portId] = snapshotId

            const relationId = Execution.Recording.Relation.formatId(sourceUoWId, edge.id, unitId)
            const relation = {
                id:           relationId,
                source:       sourceUoWId,
                target:       unitId,
                edge:         edge.id,
                type:         isSignal ? "signal" : "dataRemnant",
                dataSnapshotId: snapshotId,
            } satisfies Execution.Recording.Relation
            this.recording.relations[relationId] = relation

            incomingRelations.push(relation)
        }

        if (incomingRelations.length > 0)
            this.ctx.realtimeAPI.emit(Execution.Event.create("relation:createBatch", {
                relations: incomingRelations,
            }))
    }



    // Called from AggexEngine.onNodeCompleted.
    // Sets duration, populates outputSnapshot + DataBank entries.
    public onNodeCompleted(
        nodeId: Workflow.Node.Id,
    ): void {
        const unitId = this.mostRecentUoW.get(nodeId)
        if (!unitId) return

        const unit = this.recording.units[unitId]
        if (!unit) return

        unit.status   = "completed"
        unit.duration = performance.now() - this.origin - unit.startedAt

        const projections = this.ctx.session.node_output_projections[nodeId] ?? {}

        for (const [portIdStr, value] of Object.entries(projections)) {
            const portId  = portIdStr as Port.Output.Id
            const snapId  = Execution.Recording.DataBank.PortSnapshot.formatId(unitId, portId)

            this.recording.dataBank.snapshots[snapId] = {
                id: snapId,
                portId,
                value
            }
            unit.outputSnapshot[portId] = snapId
        }

        const metrics = this.collectMetrics(nodeId, unitId, "completed", unit.duration!)
        if (metrics) unit.metrics = metrics

        this.ctx.realtimeAPI.emit(Execution.Event.create("unit:completed", {
            unitId:         unit.id,
            duration:       unit.duration!,
            outputSnapshot: unit.outputSnapshot,
            metrics,
        }))

        this.uowInputs.delete(unitId)
    }



    // Called from AggexEngine.onNodeError.
    // Sets status to failed, duration and the error.
    public onNodeFailed(
        nodeId: Workflow.Node.Id,
        error:  SystemError.Serialized,
    ): void {
        const unitId = this.mostRecentUoW.get(nodeId)
        if (!unitId) return

        const unit = this.recording.units[unitId]
        if (!unit) return

        unit.status   = "failed"
        unit.duration = performance.now() - this.origin - unit.startedAt
        unit.error    = error

        const metrics = this.collectMetrics(nodeId, unitId, "failed", unit.duration!)
        if (metrics) unit.metrics = metrics

        this.ctx.realtimeAPI.emit(Execution.Event.create("unit:failed", {
            unitId:   unit.id,
            duration: unit.duration!,
            metrics,
        }))

        this.uowInputs.delete(unitId)
    }



    private collectMetrics(
        nodeId:   Workflow.Node.Id,
        unitId:   Execution.Recording.UnitOfWork.Id,
        status:   Execution.Recording.UnitOfWork["status"],
        duration: number,
    ): Record<string, Execution.Recording.Metric> | undefined {
        const instance = this.ctx.instanceRegistryAPI.get(nodeId)
        if (!instance) return undefined

        const inputs  = this.uowInputs.get(unitId) ?? {}
        const outputs = this.ctx.session.node_output_instances[nodeId] ?? {}

        return instance.recordMetrics({
            inputs:   inputs as any,
            outputs:  outputs as any,
            unitId,
            status,
            duration,
        })
    }



    public getRecording(): Execution.Recording {
        return this.recording
    }
}
