import { DialogSDK } from '@pretzel-graph/standard-ui/SDKs/DialogSDK'
import { Button, Dialog, Switch } from '@pretzel-graph/standard-ui/foundations'
import { SystemIcons } from '@pretzel-graph/standard-ui/icons'
import { SystemError, Workflow } from '@pretzel-graph/shared/domain'
import { toast } from 'sonner'
import Tipped from '@/components/Tipped'
import { VersionControlSDK } from '@/SDKs/VersionControlSDK/sdk'
import { LibrarySDK } from '../sdk'

export function openListPublicWorkflowDialog(workflowId: Workflow.Id) {
    const dialogId = `list-workflow-${workflowId}`

    DialogSDK.actions.push(dialogId, (props) => (
        <DialogSDK.AlertTemplate
            {...props}
            type='warning'
            onApprove={async () => {
                DialogSDK.actions.pop(dialogId)
                try {
                    await LibrarySDK.actions.workflow.listPublicWorkflow(workflowId)
                    toast.success('Workflow is now public')
                } catch (err) {
                    toast.error(SystemError.fromUnknown(err).message)
                }
            }}
            onCancel={() => DialogSDK.actions.pop(dialogId)}
        >
            <div className='font-semibold'>List this workflow publicly?</div>
            <div className='text-sm text-muted-foreground mt-1'>
                Listing this workflow on the public repository lets anyone with its
                listing id embed the active version in their own workflows as a
                sub-workflow. Publishing or activating another version updates the
                listing.
            </div>
        </DialogSDK.AlertTemplate>
    ))
}

export function openUnlistPublicWorkflowDialog(workflowId: Workflow.Id) {
    const dialogId = `unlist-workflow-${workflowId}`

    DialogSDK.actions.push(dialogId, (props) => (
        <DialogSDK.AlertTemplate
            {...props}
            type='danger'
            onApprove={async () => {
                DialogSDK.actions.pop(dialogId)
                try {
                    await LibrarySDK.actions.workflow.unlistPublicWorkflow(workflowId)
                    toast.success('Workflow is now private')
                } catch (err) {
                    toast.error(SystemError.fromUnknown(err).message)
                }
            }}
            onCancel={() => DialogSDK.actions.pop(dialogId)}
        >
            <div className='font-semibold'>Make this workflow private?</div>
            <div className='text-sm text-muted-foreground mt-1'>
                The public copy is removed and nobody new can attach it. Workflows
                that already use it keep their embedded copy, but no longer receive
                updates. Making it public again creates a new listing under a new id.
            </div>
        </DialogSDK.AlertTemplate>
    ))
}

export function openListingManagerDialog(workflowId: Workflow.Id) {
    const dialogId = `listing-manager-${workflowId}`

    DialogSDK.actions.push(dialogId, (props) => (
        <DialogSDK.SplitTemplate {...props}
            className='h-[300px]'
            sidebarClassName='w-[350px]'
            contentClassName='w-[400px]'
            sidebarRenderer={() => (
                <DialogSDK.SplitTemplate.Header>
                    <DialogSDK.SplitTemplate.Icon icon={SystemIcons.Globe} />
                    <DialogSDK.SplitTemplate.Title>Public Listing</DialogSDK.SplitTemplate.Title>
                    <DialogSDK.SplitTemplate.Description>
                        Share this workflow on the public repository, where anyone with its listing id can embed the active version as a sub-workflow.
                    </DialogSDK.SplitTemplate.Description>
                </DialogSDK.SplitTemplate.Header>
            )}
        >
            <Dialog.Title className='hidden'>Public Listing</Dialog.Title>
            <Dialog.Description className='hidden'>Share this workflow on the public repository</Dialog.Description>
            <ListingManagerContent workflowId={workflowId} dialogId={dialogId} />
        </DialogSDK.SplitTemplate>
    ))
}

const ListingManagerContent = ({ workflowId, dialogId }: { workflowId: Workflow.Id; dialogId: string }) => {
    const listingId = LibrarySDK.useStore(s => s.workflowMetas[workflowId]?.listing_id ?? null)
    const [isDeployed] = VersionControlSDK.useWith(
        (s) => s.selectors.getDeployed(s, workflowId) !== null,
        (q) => [q.deployment(workflowId)],
    )

    const isListed = listingId !== null
    const reason = !isListed && !isDeployed ? 'Deploy a version first' : null

    const handleChange = (next: boolean) => {
        if (next)
            openListPublicWorkflowDialog(workflowId)
        else
            openUnlistPublicWorkflowDialog(workflowId)
    }

    const handleCopy = async () => {
        if (!listingId)
            return
        await navigator.clipboard.writeText(listingId)
        toast.success('Listing id copied')
    }

    const toggle = <Switch checked={isListed} disabled={reason !== null} onCheckedChange={handleChange} />

    return (
        <div className='flex flex-col gap-4 h-full pt-2'>
            <div className='flex items-center justify-between'>
                <div className='flex flex-col gap-0.5'>
                    <span className='text-sm font-medium'>List Publicly</span>
                    <span className='text-xs text-muted-foreground'>Shares this workflow on the public repository</span>
                </div>
                {reason ? <Tipped label={reason}><span>{toggle}</span></Tipped> : toggle}
            </div>

            {isListed && (
                <div className='flex flex-col gap-1'>
                    <span className='text-xs font-medium text-muted-foreground'>Listing id</span>
                    <div className='flex items-center gap-1'>
                        <code className='text-xs px-2 py-1.5 rounded-md bg-muted/50 truncate'>{listingId}</code>
                        <Tipped label='Copy'>
                            <Button variant='ghost' size='icon-xs' onClick={handleCopy}>
                                <SystemIcons.Copy />
                            </Button>
                        </Tipped>
                    </div>
                </div>
            )}

            <div className='flex flex-row justify-end mt-auto'>
                <Dialog.Action size='sm' onClick={() => DialogSDK.actions.pop(dialogId)}>
                    Done
                </Dialog.Action>
            </div>
        </div>
    )
}
