import { SystemError, Resource, type Dependency } from "@pretzel-graph/shared/domain"
import type { WorkbenchSDKImpl } from "../sdk"
import { withCommit, withAsyncCommit, withCyclesRecompute, createToastPromise } from "../utils/actions"
import { api } from "@/SDKs/ApiInterceptorSDK"
import { toast } from "sonner"


export function createDependencyActions(sdk: WorkbenchSDKImpl) {
    const setDocument = sdk.setDocument
    const reducers = sdk.reducers

    const applyUpdate = async (update: Dependency.Update): Promise<boolean> => {
        const promise = createToastPromise<{ dependency: Dependency.Value }>(
            Resource.API.load(api, update),
            {
                loading: "Updating dependency…",
                success: "Dependency updated",
                error:   (err: unknown) => `Failed to update dependency: ${SystemError.fromUnknown(err).message}`,
            }
        )

        try {
            const { dependency } = await promise

            setDocument(withCyclesRecompute(d => {
                reducers.dependency.applyUpdate(d, update, dependency)
            }))
        } catch (err) {
            console.error("Failed to apply dependency update", err)
            return false
        }
        return true
    }

    const actions = {
        registerDependency: withCommit((ref, value) => {
            setDocument(d => {
                reducers.dependency.register(d, ref, value)
            })
        }),
        // Checks the saved workflow's dependencies against their sources.
        checkUpdates: async () => {
            try {
                const { updates } = await Resource.API.checkUpdates(api, { workflowId: sdk.document.workflowId })

                setDocument(d => {
                    reducers.dependency.setUpdates(d, updates)
                })

                if (updates.length > 0)
                    toast.info(`${updates.length} dependency update${updates.length === 1 ? '' : 's'} available`)
            } catch (err) {
                console.error("Failed to check dependency updates", err)
            }
        },

        update: withAsyncCommit((update) => applyUpdate(update)),

        updateAll: withAsyncCommit(async () => {
            const updates = Object.values(sdk.document.dependencyUpdates)
            const results = await Promise.all(updates.map(applyUpdate))
            return results.every(Boolean)
        }),
    } satisfies DependencyActions

    return actions
}

export type DependencyActions = {
    registerDependency: (ref: Dependency.Ref, value: Dependency.Value) => void
    checkUpdates:       () => Promise<void>
    update:             (update: Dependency.Update) => Promise<boolean>
    updateAll:          () => Promise<boolean>
}
