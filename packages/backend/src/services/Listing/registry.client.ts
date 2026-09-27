import { Injectable } from '@nestjs/common';
import { Listing, SystemError, Workflow } from '@pretzel-graph/shared/domain';
import { CloudService } from '../Cloud/cloud.service';
import { RELEASE } from '@/utils/release';

// Every read that serves a graph asks for the version this release can run.
const RELEASE_QUERY = `release=${encodeURIComponent(RELEASE)}`;

// The listing registry: open reads, token-bearing writes, reached through CloudService.
@Injectable()
export class ListingRegistry {

    constructor(private readonly cloud: CloudService) {}

    public get canRead(): boolean {
        return this.cloud.isConfigured;
    }

    public get canShare(): boolean {
        return this.cloud.hasWorkspaceIdentity;
    }


    public async get(id: Listing.Id): Promise<Listing | null> {
        const body = await this.read(`/api/listings/${id}?${RELEASE_QUERY}`, { allowNotFound: true });

        if (!body)
            return null;

        return Listing.API.Get.Response.parse(body).workflow;
    }

    public async getUpdates(ids: Workflow.Id[]): Promise<Record<Workflow.Id, Listing.PublicationMeta>> {
        if (ids.length === 0)
            return {};

        const body = await this.read(`/api/listings/updates?ids=${ids.join(',')}&${RELEASE_QUERY}`);

        return Listing.API.Updates.Response.parse(body).updates;
    }

    // This workspace's listing ids, keyed by its workflow ids.
    public async getOwnedIds(): Promise<Record<Workflow.Id, Listing.Id>> {
        const body = await this.write('GET', this.ownedPath());

        return Listing.API.Owned.Response.parse(body).listings;
    }

    // Lists the workflow, or replaces the copy if it already is.
    public async put(workflowId: Workflow.Id, request: Listing.API.Put.Request): Promise<Listing.Id> {
        const body = await this.write('PUT', this.ownedPath(workflowId), request);

        return Listing.API.Put.Response.parse(body).id;
    }

    // Replaces the copy of a listed workflow; null when it is not listed.
    public async update(workflowId: Workflow.Id, request: Listing.API.Put.Request): Promise<Listing.Id | null> {
        const body = await this.write('PATCH', this.ownedPath(workflowId), request, { allowNotFound: true });

        if (!body)
            return null;

        return Listing.API.Put.Response.parse(body).id;
    }

    public async delete(workflowId: Workflow.Id): Promise<void> {
        await this.write('DELETE', this.ownedPath(workflowId), undefined, { allowNotFound: true });
    }

    private ownedPath(workflowId?: Workflow.Id): string {
        const base = `/api/workspaces/${this.cloud.workspaceId}/listings`;

        return workflowId ? `${base}/${workflowId}` : base;
    }

    private async read(path: string, opts: { allowNotFound?: boolean } = {}): Promise<unknown> {
        const response = await this.cloud.fetch(path, { method: 'GET' });

        if (response.status === 404 && opts.allowNotFound)
            return null;

        if (!response.ok)
            throw new SystemError(SystemError.Code.BAD_REQUEST, `Listing registry answered ${response.status}`);

        return response.json();
    }

    private async write(
        method: 'GET' | 'PUT' | 'PATCH' | 'DELETE',
        path: string,
        payload?: unknown,
        opts: { allowNotFound?: boolean } = {},
    ): Promise<unknown> {
        if (!this.canShare)
            throw new SystemError(SystemError.Code.FORBIDDEN, 'This deployment cannot share workflows');

        const response = await this.cloud.fetch(path, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: payload === undefined ? undefined : JSON.stringify(payload),
        });

        if (response.status === 404 && opts.allowNotFound)
            return null;

        if (!response.ok) {
            const text = await response.text().catch(() => '');

            throw new SystemError(SystemError.Code.BAD_REQUEST, `Listing registry refused: ${response.status} ${text}`.trim());
        }

        return response.json();
    }
}
