import { z } from "zod"
import { Auth } from "../Auth"

import * as NodeMod from "./node"
import * as EdgeMod from "./edge"
import * as DataMod from "./data"
import * as CacheMod from "./cache"
import * as RepairMod from "./repair"
import { WorkflowId, FolderId } from "../ids"
import { WORKFLOW_DATA_VERSION } from "./migrate"
import { extractExposedInputs as _extractExposedInputs, extractExposedOutputs as _extractExposedOutputs, toBlueprint as _toBlueprint, collectCredentialInstanceIds as _collectCredentialInstanceIds } from "./resolvers"

export namespace Workflow {
    export const Id = WorkflowId
    export type Id = WorkflowId

    /** Reserved node id under which a run stores the workflow's global field values. */
    export const GLOBAL_FIELDS_NODE_ID = "__workflow_global_fields__" as Node.Id

    export function createId() {
        return crypto.randomUUID() as Workflow.Id
    }

    export const DEFAULT_ICON = "graph"
    export const DEFAULT_ACCENT = "utility"

    // Re-export the sub-module namespaces. `export import` carries the value,
    // the type, and nested members (e.g. Node.Id as both value and type).
    export import Node         = NodeMod.Node
    export import Edge         = EdgeMod.Edge
    export import Data         = DataMod.Data
    export import Layout       = DataMod.Data.Layout
    export import Viewport     = DataMod.Data.Viewport
    export import Cache        = CacheMod.Cache
    export import Repair       = RepairMod.Repair

    // A subworkflow's exposed ports, read from its Expose*Port nodes. Impl in ./resolvers.
    export const extractExposedInputs  = _extractExposedInputs
    export const extractExposedOutputs = _extractExposedOutputs

    // A workflow served as a node, assembled onto a base blueprint.
    export const toBlueprint = _toBlueprint

    // Every credential instance the workflow references, dependencies included. Impl in ./resolvers.
    export const collectCredentialInstanceIds = _collectCredentialInstanceIds

    export const Schema = z.object({
        id:           WorkflowId,
        display_name: z.string(),
        locked:       z.boolean(),
        hidden:       z.boolean().nullable().optional(),
        description:  z.string().optional().nullable(),
        icon:         z.string().nullable().optional(),
        accent:       z.string().nullable().optional(),
        icon_color:   z.string().nullable().optional(),

        created_at: z.coerce.date(),
        updated_at: z.coerce.date(),

        folder_id: FolderId,

        data: Data.Schema
    });

    // The workflow row without its graph.
    export namespace Meta {
        export const Schema = Workflow.Schema.omit({ data: true })
    }
    export type Meta = z.infer<typeof Meta.Schema>

    export const INITIAL = {
        id:             "" as Workflow.Id,
        locked:         false,
        display_name:   "",
        description:    "",
        icon:           null,
        accent:         null,
        icon_color:     null,
        folder_id:      "" as Workflow["folder_id"],
        created_at:     new Date(),
        updated_at:     new Date(),
        data: {
            version:               WORKFLOW_DATA_VERSION,
            globalFields:          [],
            nodes:                 {},
            edges:                 [],
            staticValues:          {},
            fieldExpressions:      {},
            credentialInstanceIds: {},
            dependencies:          {},
            ui: {
                layout:         {},
                viewport:       { x: 0, y: 0, zoom: 1 },
                icon_color:     null,
                annotations:    {},
            }
        }
    } as const satisfies z.infer<typeof Schema>
}
export type Workflow = z.infer<typeof Workflow.Schema>
