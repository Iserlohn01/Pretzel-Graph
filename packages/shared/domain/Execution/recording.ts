import z from "zod"
import { Workflow } from "../Workflow"
import { Port } from "../Foundations/Port"
import { Projection } from "../Foundations/Projection"
import { SystemError } from "../SystemError"

// ─── Recording ────────────────────────────────────────────────────────────
// Per-execution flight recorder data. 1:1 with Execution — identified by
// the execution's own id. Embedded as a nullable JSONB column on the
// executions row, so the recording lifecycle rides on the execution's.

export namespace Recording {

    // Default Redis TTL for the post-finalisation live cache.
    // The cache is only the "fresh read after recording:fullyUploaded"
    // path — Supabase is authoritative beyond that window.
    export const LIVE_TTL_SECONDS = 300

    // ─── DataBank ────────────────────────────────────────────────────────
    // Flat store of port value snapshots. One entry per (uow, port) pair.
    // Input snapshots reference the same entries as the source UoW's
    // output snapshots — no duplication across the two.

    export namespace DataBank {
        export namespace PortSnapshot {
            export const Id = z.string().brand("Execution.Recording.PortSnapshot.Id")
            export type Id = z.infer<typeof Id>

            // Deterministic — always uowId:portId, no need to pass around separately
            export const formatId = (uowId: UnitOfWork.Id, portId: Port.Id): Id =>
                `${uowId}:${portId}` as Id

            export const Schema = z.object({
                id:     Id,
                portId: Port.Id,
                value:  Projection.Schema,
            })
        }

        export const Schema = z.object({
            snapshots: z.record(PortSnapshot.Id, PortSnapshot.Schema).default({}),
        })
    }
    export type DataBank = z.infer<typeof DataBank.Schema>

    // ─── Metric ──────────────────────────────────────────────────────────
    // Node-defined per-UoW measurement. Renderer formats by `type`; `value`
    // is the raw number/string. Nodes return `Record<string, Metric>` from
    // `onRecordMetrics` — the key is the stable programmatic identifier,
    // displayName is purely cosmetic.

    export namespace Metric {
        export const Type = z.enum([
            "number",
            "string",
            "duration_ms",
            "currency_usd",
            "tokens",
        ])
        export type Type = z.infer<typeof Type>

        export const Schema = z.object({
            displayName: z.string(),
            value:       z.union([z.string(), z.number()]),
            type:        Type,
        })
    }
    export type Metric = z.infer<typeof Metric.Schema>

    // ─── UnitOfWork ──────────────────────────────────────────────────────
    // One per node execution. Cyclic nodes produce multiple UoWs on the
    // same track. Times are ms relative to origin (0 = execution start).

    export namespace UnitOfWork {
        export const Id = z.string().brand("Execution.Recording.UnitOfWork.Id")
        export type Id = z.infer<typeof Id>

        export const createId = (nodeId: Workflow.Node.Id): Id =>
            `${nodeId}:${crypto.randomUUID().slice(0, 8)}` as Id

        export const Status = z.enum(["running", "completed", "failed"])
        export type Status = z.infer<typeof Status>

        export const Schema = z.object({
            id:             Id,
            trackId:        Workflow.Node.Id,
            status:         Status,
            startedAt:      z.number(),            // ms from origin
            duration:       z.number().optional(), // ms; undefined while running
            inputSnapshot:  z.record(Port.Input.Id,  DataBank.PortSnapshot.Id).default({}),
            outputSnapshot: z.record(Port.Output.Id, DataBank.PortSnapshot.Id).default({}),
            fieldSnapshot:  z.record(z.string(), z.unknown()).optional(),
            metrics:        z.record(z.string(), Metric.Schema).optional(),
            error:          SystemError.Schema.optional(),         // set when status is failed
        })
    }
    export type UnitOfWork = z.infer<typeof UnitOfWork.Schema>

    // ─── Track ───────────────────────────────────────────────────────────
    // One per node. unitIds is append-only in execution order.

    export namespace Track {
        export const Id = Workflow.Node.Id
        export type Id = z.infer<typeof Id>

        export const Schema = z.object({
            id:      Id,
            unitIds: z.array(UnitOfWork.Id).default([]),
        })
    }
    export type Track = z.infer<typeof Track.Schema>

    // ─── Relation ────────────────────────────────────────────────────────
    // Connects two UoWs via a workflow edge.
    // "signal"      — source directly triggered target this cycle  (solid arrow)
    // "dataRemnant" — source ran in a prior cycle; target read its stale output (dashed arrow)

    export namespace Relation {
        export const Id = z.string().brand("Execution.Recording.Relation.Id")
        export type Id = z.infer<typeof Id>

        export const formatId = (source: UnitOfWork.Id, edgeId: Workflow.Edge.Id, target: UnitOfWork.Id): Id =>
            `${source}:${edgeId}:${target}` as Id

        export const Schema = z.object({
            id:             Id,
            source:         UnitOfWork.Id,
            target:         UnitOfWork.Id,
            edge:           Workflow.Edge.Id,
            type:           z.enum(["signal", "dataRemnant"]),
            dataSnapshotId: DataBank.PortSnapshot.Id,
        })
    }
    export type Relation = z.infer<typeof Relation.Schema>

    // ─── Schema ──────────────────────────────────────────────────────────
    // The embedded payload. id/executionId/workflowId/createdAt are NOT
    // here — they're on the parent Execution row.

    export const Schema = z.object({
        workflowDataSnapshot: Workflow.Data.Schema, // workflow state at execution time;
                                                    // insulates the timeline from subsequent edits
        tracks:    z.record(Track.Id,      Track.Schema     ).default({}),
        units:     z.record(UnitOfWork.Id, UnitOfWork.Schema).default({}),
        relations: z.record(Relation.Id,   Relation.Schema  ).default({}),
        dataBank:  DataBank.Schema.default({ snapshots: {} }),
    })

    // ─── Timeline UI constants ───────────────────────────────────────────
    // Pixel geometry and formatting helpers for the timeline viewer.

    export namespace Timeline {
        export const UOW_PORT_HEIGHT = 20   // px — height of one port sub-row inside a UoW block
        export const TRACK_PADDING_Y = 3    // px — vertical inset above/below the UoW block within its track row
        export const TRACK_LABEL_W   = 100  // px — width of the track label column
        export const RULER_H         = 28   // px — height of the time ruler header
        export const MIN_BLOCK_W     = 6    // px — minimum rendered width of a completed UoW block
        export const RUNNING_BLOCK_W = 32   // px — fixed width used while a UoW is still running

        export function tickIntervalMs(pixelsPerMs: number): number {
            if (pixelsPerMs >= 2)   return 10
            if (pixelsPerMs >= 0.5) return 100
            if (pixelsPerMs >= 0.1) return 500
            return 1000
        }

        export function formatMs(ms: number): string {
            if (ms >= 1000) return `${(ms / 1000).toFixed(ms % 1000 === 0 ? 0 : 1)}s`
            return `${ms}ms`
        }
    }
}
export type Recording = z.infer<typeof Recording.Schema>
