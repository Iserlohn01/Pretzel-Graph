import { Field } from "./Foundations/Field"
import { Workflow } from "./Workflow"

export namespace Airlock {

    export namespace Source {
        export type Expression = string & { readonly __brand: "AirlockExpression" }
        export type Code = string & { readonly __brand: "AirlockCode" }
        export const asExpression = (s: string) => s as Expression
        export const asCode = (s: string) => s as Code
    }
    export type Source = Source.Expression | Source.Code

    export type ParsedSource = string & { readonly __brand: "AirlockParsedString" }
    // Re-thrown by nodes (never swallowed): OOM disposed the shared isolate.
    export const TERMINATION_ERROR_NAME = "AirlockTerminationError"

    export const Globals = {
        WORKFLOW:   "__workflow__",
        IGNITER:    "__igniter__",
        IN:         "__in__",
        ITEM:       "__item__",
        ITEM_INDEX: "__item_index__",
        NODE_ID:    "__node_id__",
        GLOBALS:    "__globals__",
        METRICS:    "__metrics__",
    } as const

    const GLOBAL_FIELDS_NODE_KEY = Workflow.GLOBAL_FIELDS_NODE_ID

    const STATIC_ROOTS: Record<string, string> = {
        workflow:  Globals.WORKFLOW,
        igniter:   Globals.IGNITER,
        in:        Globals.IN,
        item:      Globals.ITEM,
        itemIndex: Globals.ITEM_INDEX,
        globals:   Globals.GLOBALS,
        metrics:   Globals.METRICS,
        
        globalFields: `${Globals.WORKFLOW}.staticValues[${JSON.stringify(GLOBAL_FIELDS_NODE_KEY)}]`,
        node:        `${Globals.WORKFLOW}.nodes[${Globals.NODE_ID}]`,
        nodeGlobals: `(${Globals.GLOBALS}[${Globals.NODE_ID}] ??= {})`,
    }

    // Matches $root at a word boundary; rewrites only the root, leaving member access intact.
    // `itemIndex` precedes `item`, and `nodeGlobals` precedes `node`, so the longer root wins.
    const SIGIL = /\$(workflow|globalFields|igniter|in|itemIndex|item|nodeGlobals|node|globals|metrics)\b/g

    export function rewrite(source: Source): string {
        return source.replace(SIGIL, (_m, root: string) => STATIC_ROOTS[root])
    }

    export type CoerceTo = "boolean" | "number" | "string"

    const COERCE_FN: Record<CoerceTo, string> = {
        boolean: "Boolean",
        number:  "Number",
        string:  "String",
    }

    // Self-invoking sync IIFE returning the (optionally coerced) value.
    // The body is wrapped as an argument/parenthesized expression, so a trailing
    // statement `;` (e.g. the ASI semicolon ts.transpileModule appends) must be
    // stripped first — `Boolean(x;)` is a syntax error.
    export function parseExpression(expr: Source.Expression, coerceTo?: CoerceTo): ParsedSource {
        const rewritten = rewrite(expr).trim().replace(/;+$/, "")
        const inner = coerceTo ? `${COERCE_FN[coerceTo]}(${rewritten})` : `(${rewritten})`
        return `(function(){ return ${inner}; })()` as ParsedSource
    }

    // Async fn-expression; $in / $node id bind to params (per-call, can't clobber). Caller applies it.
    export function parseCode(code: Source.Code): ParsedSource {
        return `(async (${Globals.IN}, ${Globals.NODE_ID}) => { ${rewrite(code)} })` as ParsedSource
    }

    export function coerceTargetForVariant(variant: Field.Variant): CoerceTo | undefined {
        switch (variant) {
            case "Integer":
            case "Float":
                return "number"
            case "Boolean":
                return "boolean"
            case "String":
            case "UniqueString":
            case "Password":
            case "Secret":
            case "MultiOption":
            case "File":
            case "Script":
                return "string"
            default:
                return undefined
        }
    }

    export type EvaluateFn = (expr: Source.Expression, coerceTo?: CoerceTo) => unknown

    export function resolveGlobalFieldValues(
        workflowData: Workflow.Data,
    ): Record<Field.Id, unknown> {
        return Field.mapValuesToIds(
            workflowData.globalFields ?? [],
            workflowData.staticValues[Workflow.GLOBAL_FIELDS_NODE_ID] ?? {},
        );
    }

    /**
     * Normalized, copy-safe shape of `$workflow` injected into the Airlock sandbox.
     *
     * Built from what the worker actually receives (`workflowId` + `Workflow.Data`).
     * Drops editor-only `ui` and nested `dependencies` to keep the runtime payload bounded.
     */
    export interface WorkflowView {
        id: Workflow.Id;
        globalFields: Field[];
        nodes: Workflow.Data["nodes"];
        edges: Workflow.Data["edges"];
        staticValues: Workflow.Data["staticValues"];
        credentialInstanceIds: Workflow.Data["credentialInstanceIds"];
    }

    export function toWorkflowView(
        workflowId: Workflow.Id,
        data: Workflow.Data,
    ): WorkflowView {
        const { ui, dependencies, ...normalized } = data;
        return {
            id: workflowId,
            globalFields: normalized.globalFields,
            nodes: normalized.nodes,
            edges: normalized.edges,
            credentialInstanceIds: normalized.credentialInstanceIds,
            staticValues: {
                ...normalized.staticValues,
                [Workflow.GLOBAL_FIELDS_NODE_ID]: resolveGlobalFieldValues(data),
            },
        };
    }

    // Rebind transient globals (e.g. $item) mid-block, within the same atomic executeSync run.
    // Keys are tracked and cleared when the block exits; reserved persistent globals are rejected.
    export type SetTransientFn = (globals: Record<string, unknown>) => void

    export interface API {
        // Set globals, run synchronously, clear — atomic on the single worker thread.
        // `setTransient` lets the run callback rebind per-iteration globals (item loops) in-block.
        executeSync<T>(globals: Record<string, unknown>, run: (evaluate: EvaluateFn, setTransient: SetTransientFn) => T): T
        // Run code-mode source async; `incoming` is passed as $in (the fn param), copied per call.
        executeAsyncCode(code: Source.Code, nodeId: Workflow.Node.Id, incoming: unknown): Promise<unknown>
        // Deep-copy a persistent scope global out to the host (e.g. `$metrics` after a sub-run).
        readGlobal<T = unknown>(name: string): T | undefined
        // Replaces the values `$globalFields` reads in this scope.
        setGlobalFieldValues(values: Record<Field.Id, unknown>): void
    }
}
