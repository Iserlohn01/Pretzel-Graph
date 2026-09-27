import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { VersionControl, Workflow } from '@pretzel-graph/shared/domain';
import { DB } from '@/db';
import { Principal } from '@/domain/Principal';
import { Repository, Transactional } from '@/db/repository';
import { ZodReturn } from '../../decorators/database';
import { sql } from 'kysely';
import { RELEASE } from '@/utils/release';

export const META_COLUMNS = ['id', 'workflow_id', 'version', 'name', 'description', 'workflow_meta', 'is_deployed', 'published_at', 'release'] as const;


@Injectable()
export class VersionControlRepository extends Repository {

    @Transactional('user')
    @ZodReturn(VersionControl.Publication.Schema)
    public async publish(principal: Principal.User, workflowId: Workflow.Id, { name, description, workflowData }: VersionControl.API.Publish.Request): Promise<VersionControl.Publication> {
        const latest = await this.trx
            .selectFrom('version_control')
            .select(({ fn }) => fn.max('version').as('version'))
            .where('workflow_id', '=', workflowId)
            .executeTakeFirst();

        // Snapshot of the workflow row at publish time, graph excluded.
        const workflow = await this.trx
            .selectFrom('workflows')
            .selectAll()
            .where('id', '=', workflowId)
            .executeTakeFirstOrThrow();

        const row = await this.trx
            .insertInto('version_control')
            .values({
                workflow_id:   workflowId,
                created_by:    principal.userId,
                version:       (latest?.version ?? 0) + 1,
                name,
                description:   description ?? null,
                workflow_meta: Workflow.Meta.Schema.parse(workflow),
                workflow_data: workflowData,
                is_deployed:   false,
                release:       RELEASE,
            })
            .returningAll()
            .executeTakeFirstOrThrow();

        return DB.VersionControl.toDomain(row);
    }

    @Transactional('user')
    @ZodReturn(VersionControl.Publication.Meta.Schema.array())
    public async list(principal: Principal.User, workflowId: Workflow.Id): Promise<VersionControl.Publication.Meta[]> {
        const rows = await this.trx
            .selectFrom('version_control')
            .select(META_COLUMNS)
            .where('workflow_id', '=', workflowId)
            .orderBy('version', 'desc')
            .execute();

        return rows.map(DB.VersionControl.toMeta);
    }

    @Transactional('user')
    @ZodReturn(VersionControl.Publication.Schema)
    public async get(principal: Principal.User, publicationId: VersionControl.Publication.Id): Promise<VersionControl.Publication> {
        const row = await this.trx
            .selectFrom('version_control')
            .selectAll()
            .where('id', '=', publicationId)
            .executeTakeFirstOrThrow();

        return DB.VersionControl.toDomain(row);
    }

    @Transactional('user')
    @ZodReturn(z.object({ workflowId: Workflow.Id, wasDeployed: z.boolean() }))
    public async remove(principal: Principal.User, publicationId: VersionControl.Publication.Id): Promise<{ workflowId: Workflow.Id; wasDeployed: boolean }> {
        const row = await this.trx
            .deleteFrom('version_control')
            .where('id', '=', publicationId)
            .returning(['workflow_id', 'is_deployed'])
            .executeTakeFirstOrThrow();

        return { workflowId: row.workflow_id, wasDeployed: row.is_deployed };
    }
}
