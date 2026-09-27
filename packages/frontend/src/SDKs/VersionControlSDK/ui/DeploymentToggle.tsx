import { Button } from "@pretzel-graph/standard-ui/foundations";
import { SystemIcons } from "@pretzel-graph/standard-ui/icons";
import Tipped from "@/components/Tipped";
import { WorkbenchSDK } from "@/routes/workflow/-SDKs/WorkbenchSDK/sdk";
import { VersionControlSDK } from "../sdk";
import { getPublicationLabel } from "../utils";

// Deploys the latest publication when off, undeploys when on.
export function DeploymentToggle({ size = "icon-sm", iconClassName }: { size?: "icon-xs" | "icon-sm"; iconClassName?: string }) {
    const workflowId = WorkbenchSDK.useDocument(d => d.workflowId);
    const [deployedPublication, [publicationsQuery]] = VersionControlSDK.useWith(
        (s) => s.selectors.getDeployed(s, workflowId),
        (q) => [q.publications(workflowId), q.deployment(workflowId)],
    );
    const latestPublication = publicationsQuery.data?.publications[0] ?? null;

    if (!latestPublication)
        return null;

    const handleClick = () => {
        if (deployedPublication)
            void VersionControlSDK.dialogs.openUndeploy(workflowId);
        else
            void VersionControlSDK.dialogs.openDeploy(latestPublication);
    };

    const label = deployedPublication
        ? `Deployed${getPublicationLabel(deployedPublication)}`
        : `Deploy ${getPublicationLabel(latestPublication)}`;

    return (
        <Tipped label={label}>
            <Button
                variant={deployedPublication ? "ghost-success" : "ghost-destructive"}
                onClick={handleClick}
            >
                {deployedPublication ? "Undeploy" : "Deploy"} <SystemIcons.Power className={iconClassName} />
            </Button>
        </Tipped>
    );
}
