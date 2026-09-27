import { useState } from 'react'
import { WorkbenchSDK } from '@/routes/workflow/-SDKs/WorkbenchSDK/sdk'
import { LibrarySDK } from '@/SDKs/LibrarySDK/sdk'
import { DialogSDK } from '@pretzel-graph/standard-ui/SDKs/DialogSDK'
import { VersionControlSDK } from '@/SDKs/VersionControlSDK'
import PublicationHistory from '@/SDKs/VersionControlSDK/ui/PublicationHistory'
import { Button, Popover, Spinner } from '@pretzel-graph/standard-ui/foundations'
import { SystemIcons } from '@pretzel-graph/standard-ui/icons'
import { Workflow } from '@pretzel-graph/shared/domain'
import Tipped from '@/components/Tipped'
import { openWorkflowSettingsDialog } from '../-SDKs/WorkbenchSDK/ui/WorkflowSettings'

export const TopRightPanel = () => {
    const workflowId = WorkbenchSDK.useDocument(d => d.workflowId);

    const [[isDeployed, isPubliclyListed], [publicationsQuery]] = VersionControlSDK.useWith(
        (s) => [s.selectors.getDeployed(s, workflowId) !== null, s.selectors.getListingId(s, workflowId) !== null] as const,
        (q) => [q.publications(workflowId), q.deployment(workflowId), q.listings],
    );

    const hasPublications = (publicationsQuery.data?.publications.length ?? 0) > 0;

    const isLocked = LibrarySDK.useStore(s => s.workflowMetas[workflowId]?.locked ?? false);
    const [isLockPending, setIsLockPending] = useState(false);

    const handleLockToggle = async () => {
        setIsLockPending(true);
        try {
            await LibrarySDK.actions.workflow.setLock(workflowId, !isLocked);
        } finally {
            setIsLockPending(false);
        }
    };

    return (
        <div className='fixed top-5 right-5 z-100 flex flex-row gap-2'>
            <div className='flex flex-row gap-2 z-10 p-0.5 rounded-xl bg-card backdrop-blur-sm border border-border shadow-md shadow-black/10'>
                <Button className='rounded-full' variant="ghost" size="sm" onClick={VersionControlSDK.dialogs.openPublish}>
                    {hasPublications && (
                        <div className={`content-[""] my-auto w-2 h-2 mr-2 rounded-full ${isDeployed ? "bg-green-400" : "bg-red-500"}`}/>
                    )}
                    <SystemIcons.CloudUpload className='size-4 mr-1'/>
                    Publish
                </Button>

                <div className='h-4 my-auto border-l border-border' />

                <Popover.Root>
                    <Popover.Trigger asChild>
                        <Button variant="ghost" size="icon-sm">
                            <SystemIcons.History className='size-4'/>
                        </Button>
                    </Popover.Trigger>
                    <Popover.Content align="end" className='p-0 rounded-xl' sideOffset={10}>
                        <PublicationHistory />
                    </Popover.Content>
                </Popover.Root>
            </div>
            <div className='p-0.5 z-10 flex flex-row gap-1 rounded-xl bg-card backdrop-blur-sm border border-border shadow-md shadow-black/10'>
                <Tipped label="Lock">
                    <Button variant="ghost" size="icon-sm" onClick={handleLockToggle} disabled={isLockPending}>
                        {isLockPending ?
                            <Spinner className='size-4'/> :
                            isLocked ?
                                <SystemIcons.LockClosed strokeWidth={2} className='size-4'/> :
                                <SystemIcons.LockOpen strokeWidth={2} className='size-4'/>
                        }
                    </Button>
                </Tipped>
                <Tipped label={isPubliclyListed ? "Unlist": "List Publicly"}>
                    <Button 
                        variant="ghost" 
                        size="icon-sm" 
                        disabled={isLockPending}
                        onClick={() => VersionControlSDK.dialogs.openListingManager(workflowId)} 
                    >
                        <SystemIcons.Globe strokeWidth={2} className={`size-4  ${isPubliclyListed && "text-blue-500"}`}/>
                    </Button>
                </Tipped>
            </div>
            <div className='p-0.5 z-10 flex flex-row gap-1 rounded-xl bg-card backdrop-blur-sm border border-border shadow-md shadow-black/10'>
                <Tipped label="Workflow Config">
                    <Button variant="ghost" size="icon-sm" onClick={openWorkflowSettingsDialog}>
                        <SystemIcons.Cog className='size-5'/>
                    </Button>
                </Tipped>
            </div>
        </div>
    )
}
