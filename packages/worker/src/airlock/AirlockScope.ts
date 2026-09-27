import ivm from "isolated-vm";
import { Airlock, Workflow } from "@pretzel-graph/shared/domain";

import type { AirlockService } from "./AirlockService";
import { bindLazyGlobal, type LazyBinding } from "./LazyInput";
import { AirlockError, AirlockTerminationError } from "./errors";

// Persistent scope globals — set once at creation, never transiently.
const RESERVED_GLOBALS: ReadonlySet<string> = new Set([
    Airlock.Globals.WORKFLOW,
    Airlock.Globals.IGNITER,
    Airlock.Globals.GLOBALS,
    Airlock.Globals.METRICS,
]);

// Large, bound-once globals routed through the lazy bridge instead of copy:true. `$item` stays
// copied — it's per-element in a hot loop where per-iteration bridge-install would regress.
const LAZY_GLOBALS: ReadonlySet<string> = new Set([Airlock.Globals.IN]);

// One ivm.Context per env, reused across re-fires. Shares the service's isolate + cache via `compiler`.
export class AirlockScope implements Airlock.API {
    constructor(
        private readonly service: AirlockService,
        private readonly context: ivm.Context,
        private readonly timeoutMs: number,
    ) {}

    // set→run→clear is one sync block → atomic, so re-fired/concurrent nodes can't clobber globals.
    public executeSync<T>(
        globals: Record<string, unknown>,
        run: (evaluate: Airlock.EvaluateFn, setTransient: Airlock.SetTransientFn) => T,
    ): T {
        const g = this.context.global;

        // Every copied key touched during the block (initial + transient rebinds) — cleared on exit.
        const touched = new Set<string>();
        // Lazy-bound globals (host-backed proxies) — released on exit / before re-bind.
        const lazyBindings = new Map<string, LazyBinding>();

        const setGlobals = (next: Record<string, unknown>) => {
            for (const [name, value] of Object.entries(next)) {
                if (RESERVED_GLOBALS.has(name))
                    throw new AirlockError(`"${name}" is a reserved persistent global and cannot be set transiently`);
                if (LAZY_GLOBALS.has(name)) {
                    lazyBindings.get(name)?.release();
                    lazyBindings.set(name, bindLazyGlobal(this.context, name, value));
                } else {
                    g.setSync(name, value, { copy: true });
                    touched.add(name);
                }
            }
        };

        setGlobals(globals);

        try {
            return run(
                (expr, coerceTo) => this.runScript(this.service.compileExpression(expr, coerceTo)),
                setGlobals,
            );
        } finally {
            if (!this.service.isDisposed)
                for (const name of touched)
                    g.deleteSync(name);
            for (const binding of lazyBindings.values())
                binding.release();
        }
    }

    // @in / @node id are fn params (per-call), not globals → re-fires can't clobber them.
    public async executeAsyncCode(
        code: Airlock.Source.Code,
        nodeId: Workflow.Node.Id,
        incoming: unknown,
    ): Promise<unknown> {
        const script = this.service.compileCode(code);

        let fn: ivm.Reference | undefined;
        try {
            fn = script.runSync(this.context, { reference: true });
            return await fn.apply(undefined, [incoming, nodeId], {
                arguments: { copy: true },
                result: { copy: true, promise: true },
                timeout: this.timeoutMs,
            });
        } catch (err) {
            if (this.service.isDisposed)
                throw new AirlockTerminationError();
            throw err instanceof Error ? err : new AirlockError(String(err), err);
        } finally {
            fn?.release();
        }
    }

    // Deep-copy a persistent global out to the host. Returns undefined if the isolate is gone.
    public readGlobal<T = unknown>(name: string): T | undefined {
        if (this.service.isDisposed) return undefined;
        try {
            return this.context.global.getSync(name, { copy: true }) as T;
        } catch {
            return undefined;
        }
    }

    public setGlobalFieldValues(values: Record<string, unknown>): void {
        this.context.evalClosureSync(
            `${Airlock.Globals.WORKFLOW}.staticValues[${JSON.stringify(Workflow.GLOBAL_FIELDS_NODE_ID)}] = $0`,
            [values],
            { arguments: { copy: true } },
        );
    }

    private runScript(script: ivm.Script): unknown {
        try {
            return script.runSync(this.context, { timeout: this.timeoutMs, copy: true });
        } catch (err) {
            if (this.service.isDisposed)
                throw new AirlockTerminationError();
            throw err instanceof Error ? err : new AirlockError(String(err), err);
        }
    }
}
