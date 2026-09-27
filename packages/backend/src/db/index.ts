import { z } from 'zod';
import { Kysely, PostgresDialect, Transaction as KyselyTransaction, type ControlledTransaction } from 'kysely';
import type { ColumnType, Generated } from 'kysely';
import { Pool, types as pgTypes, type CustomTypesConfig, type PoolConfig } from 'pg';
import { parse as parseConnectionString } from 'pg-connection-string';
import {
    Auth,
    ApiKey as ApiKeyD,
    Foundations,
    Gateway,
    Library,
    Skill          as SkillD,
    SystemError,
    Vault,
    Chat           as ChatD,
    Execution      as ExecutionD,
    VersionControl as VersionControlD,
    Workflow       as WorkflowD,
    Workspace      as WorkspaceD,
} from '@pretzel-graph/shared/domain';
import { supabaseTimestamp } from '@pretzel-graph/shared/domain/zod-utils';
import { Principal } from '@/domain/Principal';

const OID_TIMESTAMP   = 1114;
const OID_TIMESTAMPTZ = 1184;

// node-postgres parses timestamps into Date; the row schemas are typed for
// strings and `supabaseTimestamp` already normalises Postgres' raw format
// (`2026-05-22 13:47:12.123456+00`). Scoped to these pools — node-sdk's Postgres
// node shares the driver and its results are user-facing.
const keepTimestampsAsStrings: CustomTypesConfig = {
    getTypeParser: ((oid: number, format?: unknown) =>
        oid === OID_TIMESTAMP || oid === OID_TIMESTAMPTZ
            ? (value: string) => value
            : (pgTypes.getTypeParser as (o: number, f?: unknown) => unknown)(oid, format)
    ) as CustomTypesConfig['getTypeParser'],
};

function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value)
        throw new Error(`${name} is not set`);
    return value;
}

function connect(urlEnvVar: string, overrides: Partial<PoolConfig> = {}): Kysely<DB.Tables> {
    const parsed = parseConnectionString(requireEnv(urlEnvVar));

    return new Kysely<DB.Tables>({
        dialect: new PostgresDialect({
            // Cast because the parser's types are wider than the pool's — but the
            // object came from pg's own parser, so the values are ones it accepts.
            pool: new Pool({
                ...parsed,
                // A URL brackets an IPv6 host. The resolver needs the address
                // itself, or it looks up a name with brackets in it and fails.
                host: parsed.host?.replace(/^\[|\]$/g, ''),
                port: parsed.port ? Number(parsed.port) : undefined,
                max: 10,
                ...overrides,
                types: keepTimestampsAsStrings,
            } as PoolConfig),
        }),
    });
}

// Lazy so importing this module can't crash a backend that hasn't been
// configured for it yet, and so env is read after load-env has run.
let database: Kysely<DB.Tables> | undefined;

const db = () => (database ??= connect('DATABASE_URL'));

// Held transactions pin a connection for as long as a caller keeps a workflow open, so they
// get their own small pool: a few open sessions can never starve the app.
let sessionDatabase: Kysely<DB.Tables> | undefined;
const sessionDb = () => (sessionDatabase ??= connect('DATABASE_URL', { max: 5, connectionTimeoutMillis: 2_000 }));

// The persistence truth: one schema per table, column for column. Domain types
// are referenced only for branded ids and for the contents of jsonb columns —
// never for the row shape itself, so a table and its concept can diverge.
// `toDomain` is the seam between them.
//
// `.default()` here means a real column default that Postgres would apply
// (`false`, `null`). Columns the database *generates* — ids, timestamps — carry
// no client-side value, so they are marked `Generated<>` in Tables instead.

export namespace DB {


    export namespace Workflow {
        export const Row = z.object({
            id:           WorkflowD.Id,
            created_by:   Auth.User.Id.nullable(),
            folder_id:    Library.Folder.Id,
            display_name: z.string(),
            description:  z.string().nullable(),
            icon:         z.string().nullable(),
            accent:       z.string().nullable(),
            icon_color:   z.string().nullable(),
            locked:       z.boolean(),
            hidden:       z.boolean().nullable().optional(),
            mcp_enabled:  z.boolean().nullable(),
            data:         WorkflowD.Data.Schema,
            created_at:   z.coerce.date(),
            updated_at:   z.coerce.date(),
        });
        export type Row = z.infer<typeof Row>;

        export const toDomain = (row: Row) => WorkflowD.Schema.parse(row);
    }

    export namespace Folder {
        export const Row = z.object({
            id:               Library.Folder.Id,
            created_by:       Auth.User.Id.nullable(),
            parent_folder_id: Library.Folder.Id.nullable(),
            display_name:     z.string(),
            description:      z.string().nullable(),
            hidden:           z.boolean().nullable().optional(),
            created_at:       z.string(),
            updated_at:       z.string(),
        });
        export type Row = z.infer<typeof Row>;

        export const toDomain = (row: Row) => Library.Folder.Schema.parse(row);
    }

    export namespace Skill {
        export const Row = z.object({
            id:           SkillD.Id,
            created_by:   Auth.User.Id.nullable(),
            folder_id:    Library.Folder.Id,
            name:         z.string(),
            description:  z.string(),
            content:      z.string(),
            content_hash: z.string(),
            icon:         z.string().nullable(),
            accent:       z.string().nullable(),
            created_at:   z.string(),
            updated_at:   z.string(),
        });
        export type Row = z.infer<typeof Row>;

        export const toDomain = (row: Row) => SkillD.Schema.parse(row);
    }

    export namespace Execution {
        export const Row = z.object({
            id:          ExecutionD.Id,
            created_by:  Auth.User.Id.nullable(),
            workflow_id: WorkflowD.Id,
            chat_id:     ChatD.Id.nullable(),
            status:      ExecutionD.Status,
            duration:    z.number(),
            igniter:     ExecutionD.Igniter.Schema,
            session:     ExecutionD.Session.Schema,
            recording:   ExecutionD.Recording.Schema.nullable(),
            error:       SystemError.Schema.nullish(),
            created_at:  supabaseTimestamp,
            updated_at:  supabaseTimestamp,
        });
        export type Row = z.infer<typeof Row>;

        export const toDomain = (row: Row) => ExecutionD.Schema.parse(row);
    }

    export namespace Chat {
        export const Row = z.object({
            id:          ChatD.Id,
            created_by:  Auth.User.Id.nullable(),
            workflow_id: WorkflowD.Id,
            name:        z.string(),
            attachments: z.unknown().nullable(),
            // Where the chat came from, for one opened by a gateway event rather than in the editor.
            external_key: ChatD.ExternalKey.nullable(),
            created_at:  supabaseTimestamp,
            updated_at:  supabaseTimestamp,
        });
        export type Row = z.infer<typeof Row>;

        // Message.Schema is a discriminated union on `role`, so the row is an
        // intersection rather than an .extend().
        export const MessageRow = ChatD.Message.Schema.and(z.object({
            chat_id:    ChatD.Id,
            created_at: supabaseTimestamp,
            updated_at: supabaseTimestamp,
        }));
        export type MessageRow = z.infer<typeof MessageRow>;

        export const toDomain = (row: Row) => ChatD.Schema.parse(row);
    }

    export namespace VersionControl {
        export const Row = z.object({
            id:            VersionControlD.Publication.Id,
            created_by:    Auth.User.Id.nullable(),
            workflow_id:   WorkflowD.Id,
            workflow_data: WorkflowD.Data.Schema,
            // This workflow's own publication counter: 1, 2, 3…
            version:       z.number().default(1),
            // The label the user gave it, e.g. "v1.2".
            name:          z.string(),
            description:   z.string().nullable(),
            workflow_meta: WorkflowD.Meta.Schema,
            is_deployed:   z.boolean().default(false),
            published_at:  z.string(),
            // The PretzelGraph version it was published on, e.g. "0.0.735"; null before this was recorded.
            release:       z.string().nullable(),
        });
        export type Row = z.infer<typeof Row>;

        /** Row shape a Meta query selects — no created_by, no workflow_data. */
        export type MetaRow = Omit<Row, 'created_by' | 'workflow_data'>;

        export const toDomain = (row: Row) => VersionControlD.Publication.Schema.parse(row);
        export const toMeta   = (row: MetaRow) => VersionControlD.Publication.Meta.Schema.parse(row);
    }

    export namespace CredentialInstance {
        export const Row = z.object({
            id:          Vault.Credential.Instance.Id,
            created_by:  Auth.User.Id.nullable(),
            template_id: Vault.Credential.Template.Id,
            name:        z.string(),
            blob:        z.string().brand('EncryptedBlob'),
            created_at:  z.string(),
            updated_at:  z.string(),
        });
        export type Row = z.infer<typeof Row>;

        export const toDomain = (row: Row) => Vault.Credential.Instance.Schema.parse(row);
    }

    export namespace Connection {
        export const Row = z.object({
            id:            Gateway.Connection.Id,
            created_by:    Auth.User.Id.nullable(),
            folder_id:     Library.Folder.Id,
            definition_id: Gateway.Definition.Id,
            name:          z.string(),
            credential_id: Vault.Credential.Instance.Id.nullable(),
            field_values:  z.record(Foundations.Field.Id, Foundations.Field.Value),
            status:        Gateway.Connection.Status.default('pending'),
            error:         z.string().nullable(),
            created_at:    z.string(),
            updated_at:    z.string(),
        });
        export type Row = z.infer<typeof Row>;

        // The only toDomain that takes more than a row: the domain holds the credential the
        // row only references.
        export const toDomain = (row: Row, credential: Vault.Credential.Instance | null) =>
            Gateway.Connection.Schema.parse({
                id:           row.id,
                folderId:     row.folder_id,
                definitionId: row.definition_id,
                name:         row.name,
                credential,
                fieldValues:  row.field_values,
                status:       row.status,
                error:        row.error,
                createdAt:    row.created_at,
                updatedAt:    row.updated_at,
            });

        // Going the other way, the credential collapses back to its id.
        export const toRow = (connection: Gateway.Connection): Omit<Row, 'created_by' | 'created_at' | 'updated_at'> => ({
            id:            connection.id,
            folder_id:     connection.folderId,
            definition_id: connection.definitionId,
            name:          connection.name,
            credential_id: connection.credential?.id ?? null,
            field_values:  connection.fieldValues,
            status:        connection.status,
            error:         connection.error,
        });
    }

    export namespace ApiKey {
        export const Row = z.object({
            id:           ApiKeyD.Id,
            user_id:      Auth.User.Id,
            name:         z.string(),
            prefix:       z.string(),
            key_hash:     z.string(),
            last_used_at: supabaseTimestamp.nullable(),
            expires_at:   supabaseTimestamp.nullable(),
            revoked_at:   supabaseTimestamp.nullable(),
            created_at:   supabaseTimestamp,
        });
        export type Row = z.infer<typeof Row>;

        export const toDomain = (row: Row) => ApiKeyD.Schema.parse(row);
    }

    export namespace Member {
        export const Row = z.object({
            user_id:    Auth.User.Id,
            role:       WorkspaceD.Role,
            created_at: supabaseTimestamp,
            updated_at: supabaseTimestamp,
        });
        export type Row = z.infer<typeof Row>;

        export const toDomain = (row: Row) => WorkspaceD.Member.Schema.parse(row);
    }

    export namespace Workspace {
        export const Row = z.object({
            id:         z.literal(true),
            claimed_by: Auth.User.Id.nullable(),
            claimed_at: supabaseTimestamp.nullable(),
            assistant_version: z.string().nullable(),
        });
        export type Row = z.infer<typeof Row>;
    }

    export namespace User {
        export const Row = z.object({
            id:           Auth.User.Id,
            email:        z.string().nullable(),
            username:     z.string(),
            display_name: z.string(),
            avatar_url:   z.string().nullable(),
            created_at:   z.string(),
            updated_at:   z.string(),
        });
        export type Row = z.infer<typeof Row>;

        export const toDomain = (row: Row) => Auth.User.Schema.parse(row);
    }

    // Kysely is generic over this — keys are the literal Postgres table names,
    // which is what `selectFrom('workflows')` resolves against. `Gen` lists the
    // columns Postgres fills in, so they stay optional on insert.
    type Table<T extends z.ZodTypeAny, Gen extends keyof z.output<T> = never> = {
        [K in keyof z.output<T>]: K extends Gen
            ? Generated<z.output<T>[K]>
            : ColumnType<
                z.output<T>[K],
                K extends keyof z.input<T> ? z.input<T>[K] : z.output<T>[K],
                K extends keyof z.input<T> ? z.input<T>[K] : z.output<T>[K]
            >
    };

    type Stamps = 'created_at' | 'updated_at';

    export interface Tables {
        users:               Table<typeof User.Row, Stamps>;
        members:             Table<typeof Member.Row, Stamps>;
        workspace:           Table<typeof Workspace.Row, 'id'>;
        folders:             Table<typeof Folder.Row, 'id' | Stamps>;
        skills:              Table<typeof Skill.Row, 'id' | 'description' | 'content' | 'content_hash' | Stamps>;
        workflows:           Table<typeof Workflow.Row, 'id' | Stamps>;
        executions:          Table<typeof Execution.Row, 'id' | Stamps>;
        chats:               Table<typeof Chat.Row, 'id' | Stamps>;
        chat_messages:       Table<typeof Chat.MessageRow, 'id' | Stamps>;
        version_control:     Table<typeof VersionControl.Row, 'id' | 'published_at'>;
        api_keys:            Table<typeof ApiKey.Row, 'id' | 'created_at'>;
        credential_instance: Table<typeof CredentialInstance.Row, 'id' | Stamps>;
        connections:         Table<typeof Connection.Row, 'id' | 'status' | 'error' | Stamps>;
    }

    /**
     * `user` and `delegate` are indistinguishable to Postgres — both connect as
     * `authenticated` with the same auth.uid(), so RLS treats them identically.
     * The split exists only here, so a running workflow can be denied things its
     * owner may do (publishing, minting keys, writing secrets).
     */
    export const Role = { User: 'user', Delegate: 'delegate', Service: 'service' } as const;
    export type  Role = typeof Role[keyof typeof Role];

    /**
     * A transaction, branded with the identity it runs as. No default on `R` —
     * a signature must state which roles it accepts, so the permissive form
     * costs more to write than the safe one.
     */
    export type Transaction<R extends Role> = KyselyTransaction<Tables> & { readonly __as: R };

    /** The common case: RLS is on and auth.uid() is the acting user. */
    export type UserTransaction = Transaction<typeof Role.User>;

    /** RLS is on and auth.uid() is whoever the running execution acts for. */
    export type DelegateTransaction = Transaction<typeof Role.Delegate>;

    // The brand is a phantom type, so @AllowedDatabaseRoles has nothing to read.
    // symbol is the runtime half — attached by the two functions below, checked
    // by the decorator. Symbol.for so a duplicated module still matches.
    const ROLE = Symbol.for('pretzel.db.role');

    const tag = <R extends Role>(trx: KyselyTransaction<Tables>, role: R): Transaction<R> => {
        Object.defineProperty(trx, ROLE, { value: role, enumerable: false, configurable: true });
        return trx as Transaction<R>;
    };

    export const roleOf = (handle: unknown): Role | undefined =>
        (handle as Record<symbol, Role> | null | undefined)?.[ROLE];

    type ActingUser = { userId: Auth.User.Id | null };

    /** Opens a transaction and tags it with `role`. */
    async function enter<R extends Role, T>(
        role: R,
        fn: (trx: Transaction<R>) => Promise<T>,
    ): Promise<T> {
        return db().transaction().execute((trx) => fn(tag(trx, role)));
    }

    /** A transaction whose lifetime is the caller's: nothing commits until `.commit()`. */
    export type HeldDelegateTransaction = ControlledTransaction<Tables> & { readonly __as: typeof Role.Delegate };

    /** Opens a transaction on the session pool and hands it back still open. */
    export async function beginHeldDelegate(): Promise<HeldDelegateTransaction> {
        const trx = await sessionDb().startTransaction().execute();
        return tag(trx, Role.Delegate) as HeldDelegateTransaction;
    }

    /** Runs `fn` inside a transaction on behalf of `principal`. */
    export async function asUser<T>(
        principal: ActingUser,
        fn: (trx: UserTransaction) => Promise<T>,
    ): Promise<T> {
        void principal;
        return enter(Role.User, fn);
    }

    /** Runs `fn` on behalf of a running execution. */
    export async function asDelegate<T>(
        principal: Principal.Delegate,
        fn: (trx: DelegateTransaction) => Promise<T>,
    ): Promise<T> {
        void principal;
        return enter(Role.Delegate, fn);
    }

    /** Runs `fn` with no acting user. `reason` is mandatory so every use is greppable. */
    export async function asService<T>(
        reason: string,
        fn: (trx: Transaction<typeof Role.Service>) => Promise<T>,
    ): Promise<T> {
        void reason;
        return enter(Role.Service, fn);
    }

    /** Handle for the boot migration runner. */
    export function forMigrations(): Kysely<Tables> {
        return db();
    }

    export async function destroyPools(): Promise<void> {
        await database?.destroy();
        database = undefined;
        await sessionDatabase?.destroy();
        sessionDatabase = undefined;
    }
}
