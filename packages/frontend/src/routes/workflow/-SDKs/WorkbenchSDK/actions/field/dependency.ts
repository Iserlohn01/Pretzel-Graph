import type { Dependency } from "@pretzel-graph/shared/domain";
import type { WorkbenchSDKImpl } from "../../sdk";
import { withAsyncCommit, withCyclesRecompute, createToastPromise } from "../../utils/actions";
import { Resource, SystemError, type Foundations, type Workflow } from "@pretzel-graph/shared/domain";
import { api } from "@/SDKs/ApiInterceptorSDK";

export function createFieldDependencyActions(sdk: WorkbenchSDKImpl) {
    const setDocument = sdk.setDocument;
    const reducers    = sdk.reducers;
    const sel         = sdk.selectors;

    return {
        // Points the field at a dependency, reusing the embedded snapshot or fetching it.
        setValue: withAsyncCommit(async (nodeId, fieldId, ref) => {
            const existing = sel.dependency.get(sdk.document, ref)

            if (existing) {
                setDocument(withCyclesRecompute(d => {
                    reducers.field.dependency.setValue(d, nodeId, fieldId, ref, existing)
                }))
                return true
            }

            const promise = createToastPromise<{ dependency: Dependency.Value }>(
                Resource.API.load(api, ref),
                {
                    loading: "Loading workflow…",
                    success: "Workflow attached",
                    error:   (err: unknown) => `Failed to attach dependency: ${SystemError.fromUnknown(err).message}`,
                }
            )

            try {
                const { dependency } = await promise

                setDocument(withCyclesRecompute(d => {
                    reducers.field.dependency.setValue(d, nodeId, fieldId, ref, dependency)
                }))
            } catch (err) {
                console.error("Failed to attach dependency", err)
                return false
            }

            return true
        }),
    } satisfies FieldDependencyActions;
}

export interface FieldDependencyActions {
    setValue: (nodeId: Workflow.Node.Id, fieldId: Foundations.Field.Id, ref: Dependency.Ref) => Promise<boolean>
}
