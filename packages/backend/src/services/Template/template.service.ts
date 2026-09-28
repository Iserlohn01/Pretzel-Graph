import { Injectable, NotFoundException } from '@nestjs/common';
import { Listing, Template } from '@pretzel-graph/shared/domain';
import { Blueprint } from '@pretzel-graph/shared/domain/Foundations/Blueprint';
import { Principal } from '@/domain/Principal';
import { System } from '@pretzel-graph/shared/system';
import { ListingRegistry } from '../Listing/registry.client';
import { ShelfService } from '../Shelf/shelf.service';
import { LibraryRepository } from '../Library/repository';

const TEMPLATE_CACHE_TTL_MS = 5 * 60_000;

type TemplateCache = {
    templates: Record<Listing.Id, Template>
    fetchedAt: number
};

@Injectable()
export class TemplateService {

    private readonly log = System.log.withContext("Template");

    // Templates only; a graph is fetched when its template is remixed.
    private templateCache: TemplateCache | null = null;

    constructor(
        private readonly registry: ListingRegistry,
        private readonly shelf: ShelfService,
        private readonly libraryRepository: LibraryRepository,
    ) {}


    public async list(): Promise<Template.API.List.Response> {
        return { templates: await this.getTemplateCache() };
    }

    // Copies the template's graph, the version this release can run, into a new workflow in the folder.
    public async remix(principal: Principal.User, listingId: Listing.Id, request: Template.API.Remix.Request): Promise<Template.API.Remix.Response> {
        const templates = await this.getTemplateCache();
        const template = templates[listingId];

        if (!template)
            throw new NotFoundException('No such template');

        const listing = await this.registry.get(listingId);

        if (!listing)
            throw new NotFoundException('No such template');

        return this.libraryRepository.workflow.createWithData(principal, {
            folder_id:    request.folder_id,
            display_name: template.name,
            description:  template.description,
            icon:         template.icon,
            accent:       template.accent,
            icon_color:   template.iconColor,
            data:         listing.workflowData,
        });
    }


    // The templates this release can run, refetched once stale; a failed refetch keeps serving the last ones.
    private async getTemplateCache(): Promise<Record<Listing.Id, Template>> {
        if (this.templateCache && Date.now() - this.templateCache.fetchedAt < TEMPLATE_CACHE_TTL_MS)
            return this.templateCache.templates;

        if (!this.registry.canRead)
            return {};

        try {
            const registryTemplates = await this.registry.getTemplates();
            const templates: Record<Listing.Id, Template> = {};

            for (const [listingId, registryTemplate] of Object.entries(registryTemplates) as [Listing.Id, Template.API.Registry.Template][])
                templates[listingId] = await this.toTemplate(registryTemplate);

            this.templateCache = { templates, fetchedAt: Date.now() };
        } catch (error) {
            this.log.warning(`Could not fetch the templates: ${(error as Error).message}`);
        }

        return this.templateCache?.templates ?? {};
    }

    private async toTemplate(registryTemplate: Template.API.Registry.Template): Promise<Template> {
        const workflowMeta = registryTemplate.publicationMeta.workflow_meta;
        const blueprintMetas: Record<Blueprint.Id, Blueprint.Meta> = {};

        for (const blueprintId of registryTemplate.blueprintIds as Blueprint.Id[]) {
            const blueprint = await this.shelf.findBlueprint(blueprintId);

            if (blueprint)
                blueprintMetas[blueprintId] = Blueprint.Meta.Schema.parse(blueprint);
        }

        return {
            listingId:   registryTemplate.id,
            sortOrder:   registryTemplate.sortOrder,
            // Ids this release does not know leave the template under All templates only.
            categoryIds: registryTemplate.categoryIds.flatMap((categoryId) => Template.CategoryId.safeParse(categoryId).data ?? []),
            name:        workflowMeta.display_name,
            description: workflowMeta.description ?? null,
            icon:        workflowMeta.icon ?? null,
            accent:      workflowMeta.accent ?? null,
            iconColor:   workflowMeta.icon_color ?? null,
            blueprintMetas,
        };
    }
}
