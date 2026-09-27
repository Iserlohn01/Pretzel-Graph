import { z } from "zod"
import { PublicationId, WorkflowId } from "../ids"
import { Workflow } from "../Workflow"

// Canonical version-control publication record; workflow_meta and workflow_data bind to Workflow via getters.
export namespace Publication {
    export const Id = PublicationId;
    export type Id = PublicationId

    // A publication row without its graph.
    export namespace Meta {
        export const Schema = z.object({
            id:            PublicationId,
            workflow_id:   WorkflowId,
            // This workflow's own publication counter: 1, 2, 3…
            version:       z.number(),
            // The label the user gave it, e.g. "v1.2".
            name:          z.string(),
            description:   z.string().nullable(),
            // The workflow's display row as it looked when this version was published.
            get workflow_meta() { return Workflow.Meta.Schema },
            is_deployed:   z.boolean(),
            published_at:  z.coerce.date(),
            // The PretzelGraph version it was published on, e.g. "0.0.735"; absent before this was recorded.
            release:       z.string().nullable().optional(),
        })
    }
    export type Meta = z.infer<typeof Meta.Schema>

    export const Schema = Meta.Schema.extend({
        get workflow_data() { return Workflow.Data.Schema },
    })
}
export type Publication = z.infer<typeof Publication.Schema>
