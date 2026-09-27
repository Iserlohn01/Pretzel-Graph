import { VersionControlSDK } from '@/SDKs/VersionControlSDK/sdk';
import { WorkbenchSDK } from '@/routes/workflow/-SDKs/WorkbenchSDK/sdk';
import PublicationHistory from '@/SDKs/VersionControlSDK/ui/PublicationHistory'
import { DeploymentToggle } from '@/SDKs/VersionControlSDK/ui/DeploymentToggle';
import { Button } from '@pretzel-graph/standard-ui/foundations'
import { SystemIcons } from '@pretzel-graph/standard-ui/icons'

export const VersionControlSettings = () => {
    const workflowId = WorkbenchSDK.useDocument(d => d.workflowId);
    const [isDeployed, [publicationsQuery]] = VersionControlSDK.useWith(
        (s) => s.selectors.getDeployed(s, workflowId) !== null,
        (q) => [q.publications(workflowId), q.deployment(workflowId)],
    );
    const hasPublications = (publicationsQuery.data?.publications.length ?? 0) > 0;
        
    return (
        <>
            <div className='p-0.5 bg-card rounded-full absolute top-2 right-2 z-100 border border-border shadow-lg shadow-black/10 gap-1 inline-flex'>
                <Button className='rounded-full' variant="ghost" size="sm" onClick={VersionControlSDK.dialogs.openPublish}>
                    {hasPublications && (
                        <div className={`content-[""] my-auto w-2 h-2 mr-2 rounded-full ${isDeployed ? "bg-green-400" : "bg-red-500"}`}/>
                    )}
                    <SystemIcons.CloudUpload className='size-4 mr-1'/>
                    Publish
                </Button>
                <DeploymentToggle iconClassName='size-4' />
            </div>
            <PublicationHistory className="w-full" hideHeader />
        </> 
    )
}
