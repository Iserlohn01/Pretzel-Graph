import { immer } from "zustand/middleware/immer";
import { BaseSDK } from "@pretzel-graph/standard-ui/SDKs/Base";
import { SDK } from "@pretzel-graph/standard-ui/SDKs/SDKManager";
import { VersionControl, Workflow, type Listing } from "@pretzel-graph/shared/domain";
import { createWithEqualityFn } from "zustand/traditional";
import { shallow } from "zustand/shallow";
import { createVersionControlSDKActions, type VersionControlSDKActions } from "./actions";
import { createVersionControlSDKReducers, type VersionControlSDKReducers } from "./reducers";
import { versionControlSDKSelectors, type VersionControlSDKSelectors } from "./selectors";
import { _createVersionControlDialogs_, type _VersionControlSDKDialogs } from "./dialogs";

const PUBLICATIONS_STALE_TIME = 30_000
const DEPLOYMENTS_STALE_TIME = 60_000

@SDK("VersionControl")
export class VersionControlSDKImpl extends BaseSDK<VersionControlSDK.State> {
    constructor() { super() }

    public readonly useStore: BaseSDK.Store<VersionControlSDK.State> = createWithEqualityFn(
        immer<VersionControlSDK.State>(() => ({
            deployments: {},
            listings: {},
            selectors: versionControlSDKSelectors,
            reducers: createVersionControlSDKReducers(),
        })),
        shallow
    )

    public readonly actions: VersionControlSDK.Actions = createVersionControlSDKActions(this)

    public override readonly query = {
        publications: (workflowId: Workflow.Id) => ({
            queryKey:  ['version-control', 'publications', workflowId] as const,
            queryFn:   () => this.actions.list(workflowId),
            staleTime: PUBLICATIONS_STALE_TIME,
            enabled:   Boolean(workflowId),
        }),
        deployments: {
            queryKey:  ['version-control', 'deployments'] as const,
            queryFn:   () => this.actions.listDeployments(),
            staleTime: DEPLOYMENTS_STALE_TIME,
        },
        deployment: (workflowId: Workflow.Id) => ({
            queryKey:  ['version-control', 'deployment', workflowId] as const,
            queryFn:   () => this.actions.getDeployment(workflowId),
            staleTime: DEPLOYMENTS_STALE_TIME,
        }),
        listings: {
            queryKey:  ['version-control', 'listings'] as const,
            queryFn:   () => this.actions.listListings(),
            staleTime: DEPLOYMENTS_STALE_TIME,
        },
    }

    public readonly dialogs: VersionControlSDK.Dialogs = _createVersionControlDialogs_()
}

export const VersionControlSDK = SDK.get<VersionControlSDKImpl>("VersionControl")

export namespace VersionControlSDK {
    export type State = {
        deployments: Record<Workflow.Id, VersionControl.Publication.Meta>
        /** Deployed workflows shared on the public registry; absent means not listed. */
        listings: Record<Workflow.Id, Listing.Id>
        selectors: VersionControlSDKSelectors
        reducers: VersionControlSDKReducers
    }

    export type Reducers = VersionControlSDKReducers
    export type Actions = VersionControlSDKActions
    export type Selectors = VersionControlSDKSelectors
    export type Dialogs = _VersionControlSDKDialogs
}
