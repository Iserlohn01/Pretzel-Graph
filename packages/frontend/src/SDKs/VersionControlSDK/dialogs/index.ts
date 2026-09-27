import { openPublishDialog } from "./publish-dialog"
import { openDeployDialog, openUndeployDialog, openDeletePublicationDialog } from "./publication-dialogs"
import { openListWorkflowDialog, openUnlistWorkflowDialog, openListingManagerDialog } from "./listing-dialogs"

export function _createVersionControlDialogs_() {
    return {
        openPublish:           openPublishDialog,
        openDeploy:            openDeployDialog,
        openUndeploy:          openUndeployDialog,
        openDeletePublication: openDeletePublicationDialog,
        openListWorkflow:      openListWorkflowDialog,
        openUnlistWorkflow:    openUnlistWorkflowDialog,
        openListingManager:    openListingManagerDialog,
    }
}

export type _VersionControlSDKDialogs = ReturnType<typeof _createVersionControlDialogs_>
