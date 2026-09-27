import z from "zod";
import type { AxiosInstance } from "axios";
import { Workflow } from "../Workflow";
import { Publication } from "../VersionControl/publication";
import { Listing as ListingD } from "../Listing";

export namespace API {
    export namespace List {
        export const Response = z.object({
            deployments: z.record(Workflow.Id, Publication.Meta.Schema),
        })
        export type Response = z.infer<typeof Response>
    }
    export async function list(api: AxiosInstance): Promise<List.Response> {
        const { data } = await api.get<List.Response>("/api/deployment");
        return data;
    }

    export namespace Get {
        export const Response = z.object({
            publication: Publication.Meta.Schema.nullable(),
        })
        export type Response = z.infer<typeof Response>
    }
    export async function get(api: AxiosInstance, workflowId: Workflow.Id): Promise<Get.Response> {
        const { data } = await api.get<Get.Response>(`/api/deployment/${workflowId}`);
        return data;
    }

    export namespace DeployWorkflow {
        export const Response = z.object({
            publication: Publication.Schema,
        })
        export type Response = z.infer<typeof Response>
    }
    export async function deployWorkflow(api: AxiosInstance, workflowId: Workflow.Id): Promise<DeployWorkflow.Response> {
        const { data } = await api.post<DeployWorkflow.Response>(`/api/deployment/${workflowId}`);
        return data;
    }

    export namespace DeployPublication {
        export const Response = z.object({
            publication: Publication.Schema,
        })
        export type Response = z.infer<typeof Response>
    }
    export async function deployPublication(api: AxiosInstance, workflowId: Workflow.Id, publicationId: Publication.Id): Promise<DeployPublication.Response> {
        const { data } = await api.post<DeployPublication.Response>(`/api/deployment/${workflowId}/${publicationId}`);
        return data;
    }

    export namespace Undeploy {
        export const Response = z.object({
            publication: Publication.Schema,
        })
        export type Response = z.infer<typeof Response>
    }
    export async function undeploy(api: AxiosInstance, workflowId: Workflow.Id): Promise<Undeploy.Response> {
        const { data } = await api.delete<Undeploy.Response>(`/api/deployment/${workflowId}`);
        return data;
    }

    // A deployed workflow shared on the public registry, which mirrors each new deployment.
    export namespace Listing {
        export namespace List {
            export const Response = z.object({
                listings: z.record(Workflow.Id, ListingD.Id),
            })
            export type Response = z.infer<typeof Response>
        }
        export async function list(api: AxiosInstance): Promise<List.Response> {
            const { data } = await api.get<List.Response>("/api/deployment/listings");
            return data;
        }

        export namespace Create {
            export const Response = z.object({
                listingId: ListingD.Id,
            })
            export type Response = z.infer<typeof Response>
        }
        export async function create(api: AxiosInstance, workflowId: Workflow.Id): Promise<Create.Response> {
            const { data } = await api.post<Create.Response>(`/api/deployment/${workflowId}/listing`);
            return data;
        }

        export async function remove(api: AxiosInstance, workflowId: Workflow.Id): Promise<void> {
            await api.delete(`/api/deployment/${workflowId}/listing`);
        }
    }
}
