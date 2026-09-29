import { z } from 'zod';
import { Dependency, Library, Workflow } from '@pretzel-graph/shared/domain';
import { DB } from '@/db';
import { Principal } from '@/domain/Principal';
import { Repository, Transactional } from '@/db/repository';
import { ZodReturn } from '@/decorators/database';

export const WORKFLOW_META_COLUMNS = [
    'id',
    'folder_id',
    'display_name',
    'description',
    'icon',
    'accent',
    'icon_color',
    'locked',
    'hidden',
    'mcp_enabled',
    'created_at',
    'updated_at',
] as const;

export const toWorkflowMeta = (row: unknown) => Library.WorkflowMeta.Schema.parse(row);

export class WorkflowRepository extends Repository {

    @Transactional('user')
    @ZodReturn(Workflow.Schema)
    public async create(
        principal: Principal.User,
        payload: Library.API.Workflow.Create.Request,
    ): Promise<Workflow> {
        const row = await this.trx
            .insertInto('workflows')
            .values({
                ...payload,
                created_by: principal.userId,
                locked: false,
                data: Workflow.INITIAL.data,
            })
            .returningAll()
            .executeTakeFirstOrThrow();

        return DB.Workflow.toDomain(row);
    }

    @Transactional('user')
    @ZodReturn(Library.WorkflowMeta.Schema)
    public async update(
        principal: Principal.User,
        payload: Library.API.Workflow.Update.Request,
    ): Promise<Library.WorkflowMeta> {
        const row = await this.trx
            .updateTable('workflows')
            .set({
                ...(payload.display_name !== undefined && {
                    display_name: payload.display_name,
                }),
                ...(payload.description !== undefined && {
                    description: payload.description ?? null,
                }),
                ...(payload.icon !== undefined && { icon: payload.icon }),
                ...(payload.accent !== undefined && { accent: payload.accent }),
                ...(payload.icon_color !== undefined && {
                    icon_color: payload.icon_color,
                }),
                ...(payload.locked !== undefined && { locked: payload.locked }),
                ...(payload.hidden !== undefined && { hidden: payload.hidden || null }),
                ...(payload.folder_id !== undefined && { folder_id: payload.folder_id }),
            })
            .where('id', '=', payload.id)
            .returning(WORKFLOW_META_COLUMNS)
            .executeTakeFirstOrThrow();

        return toWorkflowMeta(row);
    }

    @Transactional('user')
    @ZodReturn(Workflow.Schema)
    public async get(
        principal: Principal.User,
        workflowId: Workflow.Id,
    ): Promise<Workflow> {
        const row = await this.trx
            .selectFrom('workflows')
            .selectAll()
            .where('id', '=', workflowId)
            .executeTakeFirstOrThrow();

        return DB.Workflow.toDomain(row);
    }

    @Transactional('user')
    @ZodReturn(z.array(Dependency.Update.Draft.Schema))
    public async checkUpdates(
        principal: Principal.User,
        dependencies: Array<Pick<Dependency.Update.Draft, 'id' | 'updated_at'>>,
    ): Promise<Dependency.Update.Draft[]> {
        if (!dependencies.length)
            return [];

        const snapshotUpdatedAt = new Map(
            dependencies.map((dependency) => [
                dependency.id,
                dependency.updated_at,
            ]),
        );
        const workflowIds = dependencies.map((dependency) => dependency.id);

        const rows = await this.trx
            .selectFrom('workflows')
            .select(['id', 'updated_at'])
            .where('id', 'in', workflowIds)
            .execute();

        const updates: Dependency.Update.Draft[] = [];

        for (const row of rows) {
            const stored = snapshotUpdatedAt.get(row.id);
            const changed = new Date(stored ?? 0).getTime() !== new Date(row.updated_at).getTime();

            if (changed) {
                updates.push({
                    kind: "draftWorkflow",
                    id: row.id,
                    updated_at: row.updated_at,
                });
            }
        }

        return updates;
    }

    @Transactional('user')
    public async delete(principal: Principal.User, id: Workflow.Id): Promise<void> {
        await this.trx
            .deleteFrom('workflows')
            .where('id', '=', id)
            .execute();
    }

    // A new workflow holding a graph that came from elsewhere.
    @Transactional('user')
    @ZodReturn(Workflow.Schema)
    public async createWithData(
        principal: Principal.User,
        payload: Library.API.Workflow.Create.Request & Pick<Workflow, 'icon' | 'accent' | 'icon_color' | 'data'>,
    ): Promise<Workflow> {
        const row = await this.trx
            .insertInto('workflows')
            .values({
                folder_id: payload.folder_id,
                display_name: payload.display_name,
                description: payload.description ?? null,
                icon: payload.icon,
                accent: payload.accent,
                icon_color: payload.icon_color,
                data: payload.data,
                created_by: principal.userId,
                locked: false,
            })
            .returningAll()
            .executeTakeFirstOrThrow();

        return DB.Workflow.toDomain(row);
    }

    @Transactional('user')
    @ZodReturn(Workflow.Schema)
    public async duplicate(
        principal: Principal.User,
        id: Workflow.Id,
    ): Promise<Workflow> {
        const source = await this.trx
            .selectFrom('workflows')
            .selectAll()
            .where('id', '=', id)
            .executeTakeFirstOrThrow();

        const row = await this.trx
            .insertInto('workflows')
            .values({
                folder_id: source.folder_id,
                display_name: `Copy of ${source.display_name}`,
                description: source.description,
                icon: source.icon,
                accent: source.accent,
                icon_color: source.icon_color,
                data: source.data,
                created_by: principal.userId,
                locked: false,
                hidden: source.hidden,
                mcp_enabled: source.mcp_enabled,
            })
            .returningAll()
            .executeTakeFirstOrThrow();

        return DB.Workflow.toDomain(row);
    }
}
