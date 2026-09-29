import { z } from "zod"
import type { AxiosInstance } from "axios"
import type { Workflow } from "./Workflow"
import { Listing } from "./Listing"
import { Folder } from "./Library/folder"
import { Blueprint } from "./Foundations/Blueprint"
import { TEMPLATE_CATEGORIES, type TemplateCategoryId } from "../constants/templateCategories"

// Published workflows offered as starting points for a new workflow.
export namespace Template {

    export const CategoryId = z.enum(Object.keys(TEMPLATE_CATEGORIES) as [TemplateCategoryId, ...TemplateCategoryId[]])
    export type  CategoryId = z.infer<typeof CategoryId>

    // The graph is not part of a template; remixing fetches it from the listing.
    export const Schema = z.object({
        listingId:      Listing.Id,
        sortOrder:      z.number().int(),
        categoryIds:    z.array(CategoryId),
        name:           z.string(),
        description:    z.string().nullable(),
        icon:           z.string().nullable(),
        accent:         z.string().nullable(),
        iconColor:      z.string().nullable(),
        // Each blueprint the graph uses, once.
        blueprintMetas: z.record(Blueprint.Id, Blueprint.Meta.Schema),
    })

    export namespace API {

        // What the registry lists: each template with its category ids known or not.
        export namespace Registry {
            export const Template = z.object({
                id:              Listing.Id,
                publicationMeta: Listing.PublicationMeta,
                version:         z.number().int(),
                release:         z.string(),
                publishedAt:     z.coerce.date(),
                createdAt:       z.coerce.date(),
                sortOrder:       z.number().int(),
                categoryIds:     z.array(z.string()),
                blueprintIds:    z.array(z.string()),
            })
            export type Template = z.infer<typeof Template>

            export const Response = z.object({ templates: z.record(Listing.Id, Template) })
            export type  Response = z.infer<typeof Response>
        }

        export namespace List {
            export const Response = z.object({ templates: z.record(Listing.Id, Schema) })
            export type  Response = z.infer<typeof Response>
        }

        export namespace Remix {
            export const Request = z.object({ folder_id: Folder.Id })
            export type  Request = z.infer<typeof Request>
            export type  Response = Workflow
        }

        export async function list(api: AxiosInstance): Promise<List.Response> {
            const { data } = await api.get("/api/library/templates")
            return List.Response.parse(data)
        }

        export async function remix(api: AxiosInstance, listingId: Listing.Id, req: Remix.Request): Promise<Remix.Response> {
            const { data } = await api.post<Remix.Response>(`/api/library/templates/${listingId}/remix`, req)
            return data
        }
    }
}
export type Template = z.infer<typeof Template.Schema>
