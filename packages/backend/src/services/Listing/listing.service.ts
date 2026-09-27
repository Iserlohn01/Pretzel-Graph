import type { Dependency } from '@pretzel-graph/shared/domain';
import { Injectable } from '@nestjs/common';
import { Principal } from '@/domain/Principal';
import { Listing, SystemError, VersionControl, Workflow } from '@pretzel-graph/shared/domain';
import { DeploymentRepository } from '../Deployment/deployment.repository';
import { ListingRegistry } from './registry.client';
import { System } from '@pretzel-graph/shared/system';
import { RELEASE } from '@/utils/release';

const ROOT_FOLDER_ID = '00000000-0000-4000-8000-000000000001' as Workflow['folder_id'];

@Injectable()
export class ListingService {

    private readonly log = System.log.withContext("Listing");

    constructor(
        private readonly deployments: DeploymentRepository,
        private readonly registry: ListingRegistry,
    ) {}



    // A listing as the editor shows it: the graph, locked.
    public async getWorkflow(listingId: Listing.Id): Promise<Workflow | null> {
        if (!this.registry.canRead)
            return null;

        const entry = await this.registry.get(listingId);

        if (!entry)
            return null;

        const meta = entry.publicationMeta;

        return Workflow.Schema.parse({
            id:           listingId,
            display_name: meta.workflow_meta.display_name,
            description:  meta.workflow_meta.description,
            icon:         meta.workflow_meta.icon,
            accent:       meta.workflow_meta.accent,
            icon_color:   meta.workflow_meta.icon_color,
            locked:       true,
            folder_id:    ROOT_FOLDER_ID,
            created_at:   meta.published_at,
            updated_at:   meta.published_at,
            data:         entry.workflowData,
        });
    }

    public async getPublication(listingId: Listing.Id): Promise<Dependency.Value.Publication | null> {
        if (!this.registry.canRead)
            return null;

        const entry = await this.registry.get(listingId);

        return entry ? Listing.toPublication(entry) : null;
    }

    // Listings whose deployed publication moved on from the one each snapshot was taken at.
    public async checkUpdates(
        dependencies: Array<Pick<Dependency.Update.Listing, 'id' | 'publicationId'>>,
    ): Promise<Dependency.Update.Listing[]> {
        if (!this.registry.canRead || dependencies.length === 0)
            return [];

        const current = await this.registry.getUpdates(dependencies.map((dependency) => dependency.id));
        const updates: Dependency.Update.Listing[] = [];

        for (const dependency of dependencies) {
            const info = current[dependency.id];

            if (!info || info.id === dependency.publicationId)
                continue;

            updates.push({
                kind:          "listing",
                id:            dependency.id,
                publicationId: info.id,
                version:       info.version,
                name:          info.name,
                description:   info.description,
            });
        }

        return updates;
    }

    // Which of this deployment's workflows are listed; empty when the registry cannot say.
    public async getOwnedIds(): Promise<Record<Workflow.Id, Listing.Id>> {
        if (!this.registry.canShare)
            return {};

        try {
            return await this.registry.getOwnedIds();
        }
        catch (error) {
            this.log.warning(`Could not read own listings: ${(error as Error).message}`);

            return {};
        }
    }

    public async shareWorkflow(principal: Principal.User, workflowId: Workflow.Id): Promise<Listing.Id> {
        if (!this.registry.canShare)
            throw new SystemError(SystemError.Code.FORBIDDEN, 'This deployment cannot share workflows');

        const deployment = await this.deployments.get(principal, workflowId);

        if (!deployment)
            throw new SystemError(SystemError.Code.CONFLICT, 'Deploy a version before making this workflow public');

        const bound = getNodesBindingCredentials(deployment.workflow_data);

        if (bound.length > 0)
            throw new SystemError(
                SystemError.Code.CONFLICT,
                'Remove credential bindings before making this workflow public',
                { data: { nodeIds: bound } },
            );

        return this.registry.put(workflowId, toRequest(deployment));
    }

    // The registry mirrors the publication that was just deployed.
    public async syncDeployed(publication: VersionControl.Publication): Promise<void> {
        if (!this.registry.canShare)
            return;

        await this.registry.update(publication.workflow_id, toRequest(publication));
    }

    public async unshareWorkflow(workflowId: Workflow.Id): Promise<void> {
        if (!this.registry.canShare)
            return;

        await this.registry.delete(workflowId);
    }
}

function toRequest(publication: VersionControl.Publication): Listing.API.Put.Request {
    const { workflow_data, ...meta } = publication;

    return {
        publicationMeta: Listing.PublicationMeta.parse(meta),
        workflowData:    workflow_data,
        release:         publication.release ?? RELEASE,
    };
}

function getNodesBindingCredentials(data: Workflow.Data): Workflow.Node.Id[] {
    return Object.entries(data.credentialInstanceIds)
        .filter(([, bindings]) => Object.keys(bindings).length > 0)
        .map(([nodeId]) => nodeId as Workflow.Node.Id);
}
