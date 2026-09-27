import { z } from "zod"
import type { AxiosInstance } from "axios"
import { Workflow } from "./Workflow"
import { VersionControl } from "./VersionControl"
import { Dependency } from "./Dependency"
import { ListingId, LISTING_ID_PREFIX, isListingId as isListingIdValue } from "./ids"

// A workflow shared through the listing registry, usable by any deployment.
export namespace Listing {

    export const Id = ListingId
    export type  Id = ListingId

    export const ID_PREFIX = LISTING_ID_PREFIX

    export const isListingId = isListingIdValue

    export const createId = (): Id =>
        `${LISTING_ID_PREFIX}${crypto.randomUUID().slice(LISTING_ID_PREFIX.length)}` as Id

    // A publication's metadata without its deployment state.
    export const PublicationMeta = VersionControl.Publication.Meta.Schema.omit({ is_deployed: true })
    export type PublicationMeta = z.infer<typeof PublicationMeta>

    // One of the owner's deployed publications, verbatim, under the registry's id: the version
    // the caller's release resolves to.
    export const Schema = z.object({
        id:              Id,
        publicationMeta: PublicationMeta,
        get workflowData() { return Workflow.Data.Schema },
        // Set by the registry operator on extended shelf entries only.
        blueprintId:     z.string().nullable().optional(),
        version:         z.number().int(),
        release:         z.string(),
        publishedAt:     z.coerce.date(),
        createdAt:       z.coerce.date(),
    })

    // The embedded form a depending workflow keeps, under the registry's id.
    export function toPublication(listing: Listing): Dependency.Value.Publication {
        const meta = listing.publicationMeta

        return Dependency.Value.Publication.Schema.parse({
            ...meta,
            kind:          "listing",
            workflow_id:   listing.id,
            display_name:  meta.workflow_meta.display_name,
            icon:          meta.workflow_meta.icon,
            accent:        meta.workflow_meta.accent,
            workflow_data: listing.workflowData,
        })
    }

    export namespace API {

        export namespace Get {
            export const Response = z.object({
                workflow: Listing.Schema,
            })
            export type Response = z.infer<typeof Response>
        }

        export namespace Updates {
            export const Response = z.object({
                updates: z.record(Workflow.Id, PublicationMeta),
            })
            export type Response = z.infer<typeof Response>
        }

        export namespace ExtendedShelf {
            export const Response = z.object({
                workflows: z.array(Listing.Schema),
            })
            export type Response = z.infer<typeof Response>
        }

        // This deployment's own listings, keyed by workflow id.
        export namespace Owned {
            export const Response = z.object({
                listings: z.record(Workflow.Id, Id),
            })
            export type Response = z.infer<typeof Response>
        }

        // The publication to serve; the workflow is named in the path.
        export namespace Put {
            export const Request = z.object({
                publicationMeta: PublicationMeta,
                get workflowData() { return Workflow.Data.Schema },
                // The release the publication was built on.
                release:         z.string(),
            })
            export type Request = z.infer<typeof Request>

            export const Response = z.object({
                id: Id,
            })
            export type Response = z.infer<typeof Response>
        }

    }
}
export type Listing = z.infer<typeof Listing.Schema>
