import type { HTTP, RuntimeNode } from "@pretzel-graph/node-sdk";
import { Execution, Resource, Shelf, Vault, Workbench, Workflow, type Dependency, type Foundations } from "@pretzel-graph/shared/domain";

import API = Workbench.API;

const HEARTBEAT_MS = 20_000;

const isGone = (error: unknown) => (error as { response?: { status?: number } })?.response?.status === 404;

/**
 * One workflow as something to read and edit from inside a run, over the run's internal API.
 *
 * The document is here, in the run, inside `operations`. It opens on a snapshot for reading;
 * a transaction replaces it with the row as held and opens it for writing, the backend keeps
 * the row locked for the transaction's length, every edit is announced on the run's channel,
 * and commit sends the whole graph back.
 */
export class WorkbenchClient {

    public readonly operations = new Workbench.OperationalClient(
        blueprintId => this.resolveBlueprint(blueprintId),
        instanceId  => this.resolveCredential(instanceId),
        ref         => this.resolveDependency(ref),
        edit        => this.announce(edit),
    );

    #heartbeat: NodeJS.Timeout | null = null;
    #opening:   Promise<void> | null  = null;

    private constructor(
        private readonly http:       HTTP.Client,
        private readonly realtime:   RuntimeNode.RealtimeAPI,
        private readonly workflowId: Workflow.Id,
    ) {}

    /** Reads are answerable from the first call: the snapshot is fetched before the client is handed out. */
    public static async open(http: HTTP.Client, realtime: RuntimeNode.RealtimeAPI, workflowId: Workflow.Id): Promise<WorkbenchClient> {
        const client = new WorkbenchClient(http, realtime, workflowId);

        await client.loadSnapshot();

        return client;
    }

    public get inTransaction(): boolean {
        return this.#heartbeat !== null;
    }

    public getMeta() {
        return API.Session.getMeta(this.http.raw, this.workflowId);
    }

    // ── Transaction ──────────────────────────────────────────────────────────

    /** Lock and load. Refused while anyone — this run included — holds the workflow. */
    public async beginTransaction(): Promise<void> {
        if (this.inTransaction)
            throw new Error(`A transaction on ${this.workflowId} is already open`);

        const snapshot = await API.Session.beginTransaction(this.http.raw, this.workflowId);

        this.operations.load(this.build(snapshot), "write");

        this.#heartbeat = setInterval(() => {
            void API.Session.heartbeat(this.http.raw, this.workflowId).catch(error => {
                // The backend closed it without us — the run ended, or the hold was reaped.
                if (isGone(error))
                    void this.#finish(async () => {});
            });
        }, HEARTBEAT_MS);
        this.#heartbeat.unref?.();
    }

    /** Opens lazily; concurrent callers share the one begin. */
    public ensureTransaction(): Promise<void> {
        if (this.inTransaction)
            return Promise.resolve();

        this.#opening ??= this.beginTransaction().finally(() => { this.#opening = null });

        return this.#opening;
    }

    /** Writes the held graph back; what was held stays loaded, now as the read snapshot. */
    public async commitTransaction(): Promise<void> {
        if (!this.inTransaction)
            throw new Error(`No open transaction on ${this.workflowId}`);

        const document = this.operations.getDocument();

        await this.#finish(() => API.Session.commitTransaction(this.http.raw, this.workflowId, { data: document.data }));

        this.operations.load(document, "read");
    }

    /** Drops the held graph; reads go back to the row. */
    public async abortTransaction(): Promise<void> {
        if (!this.inTransaction)
            return;

        await this.#finish(() => API.Session.abortTransaction(this.http.raw, this.workflowId));
        await this.loadSnapshot();
    }

    /** One edit, one short hold. */
    public async runTransaction<T>(fn: () => T | Promise<T>): Promise<T> {
        await this.beginTransaction();

        try {
            const result = await fn();
            await this.commitTransaction();
            return result;
        }
        catch (error) {
            await this.abortTransaction();
            throw error;
        }
    }

    // ── Internals ────────────────────────────────────────────────────────────

    private async loadSnapshot() {
        this.operations.load(this.build(await Workbench.API.Workflow.get(this.http.raw, { workflowId: this.workflowId })), "read");
    }

    private build(snapshot: API.Session.Begin.Response): Workbench.Document {
        const { workflow, blueprints, repairs } = snapshot;
        const data     = Workflow.Repair.applyAll(workflow.data, repairs).data;
        const document = Workbench.Document.create(workflow.id, data, blueprints);

        Workbench.Document.withCyclesRecompute(d => d.reducers.workflow.validate(d))(document);

        return document;
    }

    /** From the document when it already knows the blueprint, from the shelf otherwise. */
    private async resolveBlueprint(blueprintId: Foundations.Blueprint.Id): Promise<Foundations.Blueprint> {
        const d     = this.operations.document;
        const known = d.selectors.blueprint.get(d, blueprintId);

        if (known)
            return known;

        const { blueprint } = await Shelf.API.Internal.get(this.http.raw, blueprintId);

        return blueprint;
    }

    private async resolveCredential(instanceId: Vault.Credential.Instance.Id): Promise<Vault.Credential.Summary | null> {
        const { instances } = await Vault.API.Internal.query(this.http.raw, { ids: [instanceId] });

        return instances[0] ?? null;
    }

    private async resolveDependency(ref: Dependency.Ref): Promise<Dependency.Value> {
        const { dependency } = await Resource.API.load(this.http.raw, ref);

        return dependency;
    }

    // Edits travel on the run's own channel; the backend relays them onto the workflow's once
    // it has checked this run holds it.
    private announce(edit: Workbench.Event.Unstamped) {
        this.realtime.emit(Execution.Event.create("workbench:edit", { targetWorkflowId: this.workflowId, edit }));
    }

    async #finish(send: () => Promise<unknown>) {
        if (this.#heartbeat)
            clearInterval(this.#heartbeat);

        this.#heartbeat = null;
        await send();
    }
}
