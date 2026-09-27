import { z } from "zod"
import type { AxiosInstance } from "axios"
import { Workflow as WorkflowD } from "../../Workflow"
import { Folder as FolderD } from "../folder"

export namespace Workflow {
    export namespace Create {
        export const Request = z.object({
            folder_id: FolderD.Id,
            display_name: z.string().min(1),
            description: z.string().nullable().optional(),
        });
        export type Request = z.infer<typeof Request>;
        export type Response = WorkflowD;
    }
    export namespace Update {
        export const Request = z.object({
            id: WorkflowD.Id,
            display_name: z.string().min(1).optional(),
            description: z.string().nullable().optional(),
            icon: z.string().nullable().optional(),
            accent: z.string().nullable().optional(),
            icon_color: z.string().nullable().optional(),
            locked: z.boolean().optional(),
            hidden: z.boolean().optional(),
            folder_id: FolderD.Id.optional(),
        });
        export type Request = z.infer<typeof Request>;
        export type Response = WorkflowD.Meta;
    }
    export namespace Get {
        export const Request = z.object({ id: WorkflowD.Id });
        export type Request = z.infer<typeof Request>;
        export type Response = WorkflowD;
    }
    export namespace Remove {
        export const Request = z.object({ id: WorkflowD.Id });
        export type Request = z.infer<typeof Request>;
        export type Response = { ok: true };
    }

    export async function create(
        api: AxiosInstance,
        req: Create.Request,
    ): Promise<Create.Response> {
        const { data } = await api.post<Create.Response>("/api/library/workflows", req);
        return data;
    }

    export async function update(
        api: AxiosInstance,
        req: Update.Request,
    ): Promise<Update.Response> {
        const { id, ...payload } = req;
        const { data } = await api.patch<Update.Response>(`/api/library/workflows/${id}`, payload);
        return data;
    }

    export async function remove(
        api: AxiosInstance,
        req: Remove.Request,
    ): Promise<Remove.Response> {
        const { data } = await api.delete<Remove.Response>(`/api/library/workflows/${req.id}`);
        return data;
    }

    export namespace Duplicate {
        export const Request = z.object({ id: WorkflowD.Id });
        export type Request = z.infer<typeof Request>;
        export type Response = WorkflowD;
    }

    export async function duplicate(
        api: AxiosInstance,
        req: Duplicate.Request,
    ): Promise<Duplicate.Response> {
        const { data } = await api.post<Duplicate.Response>(`/api/library/workflows/${req.id}/duplicate`);
        return data;
    }
}
