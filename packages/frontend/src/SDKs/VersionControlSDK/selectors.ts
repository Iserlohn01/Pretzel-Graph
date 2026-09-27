import { VersionControl, Workflow, type Listing } from "@pretzel-graph/shared/domain";
import type { VersionControlSDK } from "./sdk";

export const versionControlSDKSelectors = {
    getDeployed: (state, workflowId) => {
        return state.deployments[workflowId] ?? null;
    },
    getListingId: (state, workflowId) => {
        return state.listings[workflowId] ?? null;
    },
} satisfies VersionControlSDKSelectors;

export type VersionControlSDKSelectors = {
    getDeployed: (state: VersionControlSDK.State, workflowId: Workflow.Id) => VersionControl.Publication.Meta | null
    getListingId: (state: VersionControlSDK.State, workflowId: Workflow.Id) => Listing.Id | null
};
