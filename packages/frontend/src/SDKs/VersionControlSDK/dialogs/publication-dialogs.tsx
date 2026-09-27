import { DialogSDK } from "@pretzel-graph/standard-ui/SDKs/DialogSDK";
import type { VersionControl, Workflow } from "@pretzel-graph/shared/domain";
import { toast } from "sonner";
import { VersionControlSDK } from "../sdk";
import { getPublicationLabel } from "../utils";

const isListing = (workflowId: Workflow.Id) =>
    VersionControlSDK.state.selectors.getListingId(VersionControlSDK.state, workflowId) !== null;

const ListingNote = () => (
    <div className="text-sm text-muted-foreground mt-2">
        This workflow is public. With no deployed version it becomes private; make it public again once a version is deployed.
    </div>
);

export async function openDeployDialog(publication: VersionControl.Publication.Meta) {
    const dialogId = `deploy-publication-${publication.id}`;

    const { publication: deployed } = await VersionControlSDK.fetch(VersionControlSDK.query.deployment(publication.workflow_id));
    const replaced = deployed && deployed.id !== publication.id ? deployed : null;

    DialogSDK.actions.push(dialogId, (props) => (
        <DialogSDK.AlertTemplate
            {...props}
            type="warning"
            approveLabel="Deploy"
            onApprove={async () => {
                try {
                    await VersionControlSDK.actions.deployPublication(publication.workflow_id, publication.id);
                    toast.success(`${getPublicationLabel(publication)} deployed`);
                    DialogSDK.actions.pop(dialogId);
                } catch {
                    toast.error("Could not deploy version");
                }
            }}
            onCancel={() => DialogSDK.actions.pop(dialogId)}
        >
            <div className="font-semibold">
                Deploy version?
            </div>
            <div className="text-sm text-muted-foreground mt-1">
                <span className="font-semibold text-foreground">{getPublicationLabel(publication)}</span> goes live immediately.
                Its webhooks start accepting requests and its connection listeners start reacting to events.
            </div>
            {replaced &&
                <div className="text-sm text-muted-foreground mt-2">
                    It replaces <span className="font-semibold text-foreground">{getPublicationLabel(replaced)}</span>, which stops receiving events.
                </div>
            }
            {isListing(publication.workflow_id) &&
                <div className="text-sm text-muted-foreground mt-2">
                    This workflow is public. Its listing will serve this version.
                </div>
            }
        </DialogSDK.AlertTemplate>
    ));
}

export async function openUndeployDialog(workflowId: Workflow.Id) {
    const { publication } = await VersionControlSDK.fetch(VersionControlSDK.query.deployment(workflowId));

    if (!publication)
        return;

    const dialogId = `undeploy-publication-${publication.id}`;

    DialogSDK.actions.push(dialogId, (props) => (
        <DialogSDK.AlertTemplate
            {...props}
            type="warning"
            approveLabel="Undeploy"
            onApprove={async () => {
                try {
                    await VersionControlSDK.actions.undeploy(workflowId);
                    toast.success(`${getPublicationLabel(publication)} undeployed`);
                    DialogSDK.actions.pop(dialogId);
                } catch {
                    toast.error("Could not undeploy version");
                }
            }}
            onCancel={() => DialogSDK.actions.pop(dialogId)}
        >
            <div className="font-semibold">
                Undeploy version?
            </div>
            <div className="text-sm text-muted-foreground mt-1">
                <span className="font-semibold text-foreground">{getPublicationLabel(publication)}</span> will be undeployed.
                Its webhooks and connection listeners stop immediately.
            </div>
            <div className="text-sm text-muted-foreground mt-2">
                The version is not deleted — you can deploy it again at any time.
            </div>
            {isListing(workflowId) && <ListingNote />}
        </DialogSDK.AlertTemplate>
    ));
}

export function openDeletePublicationDialog(publication: VersionControl.Publication.Meta) {
    const dialogId = `delete-publication-${publication.id}`;

    DialogSDK.actions.push(dialogId, (props) => (
        <DialogSDK.AlertTemplate
            {...props}
            type="danger"
            approveLabel="Delete"
            onApprove={async () => {
                try {
                    await VersionControlSDK.actions.remove(publication.workflow_id, publication.id);
                    toast.success(`${getPublicationLabel(publication)} deleted`);
                    DialogSDK.actions.pop(dialogId);
                } catch {
                    toast.error("Could not delete version");
                }
            }}
            onCancel={() => DialogSDK.actions.pop(dialogId)}
        >
            <div className="font-semibold">
                Delete version?
            </div>
            <div className="text-sm text-muted-foreground">
                This removes <span className="font-semibold text-destructive">{getPublicationLabel(publication)}</span> from publication history.
            </div>
            {publication.is_deployed && isListing(publication.workflow_id) && <ListingNote />}
        </DialogSDK.AlertTemplate>
    ));
}
