import { useState } from 'react'
import { Badge, Dialog, Spinner, Tabs } from '@pretzel-graph/standard-ui/foundations'
import { Workflow } from '@pretzel-graph/shared/domain'
import { SystemIcons } from '@pretzel-graph/standard-ui/icons'
import { DialogSDK } from '@pretzel-graph/standard-ui/SDKs/DialogSDK'
import { VersionControlSDK } from '@/SDKs/VersionControlSDK'
import { DEPENDENCY_SELECTOR_DIALOG_ID, type DependencySelectorOptions, type LocalWorkflowKind } from './constants'

export const getDependencyTypeDialogId = (workflowId: Workflow.Id) => `dependency-type-${workflowId}`

export const openDependencyTypeDialog = (workflowId: Workflow.Id, onSelect: DependencySelectorOptions['onSelect']) => {

    const dialogId = getDependencyTypeDialogId(workflowId)

    DialogSDK.actions.push(dialogId, (props) => (
        <DialogSDK.Template {...props} className='p-2'>
            <DependencyTypeDialog
                workflowId={workflowId}
                onSelect={onSelect}
            />
        </DialogSDK.Template>
    ))
}

const kindDescriptions: Record<LocalWorkflowKind, string> = {
    draftWorkflow: "Follows the workflow's current working version. You'll be offered an update whenever it's saved with changes.",
    publishedWorkflow: "Pins to the workflow's active published version. You'll be offered an update only when a new version is published.",
}

interface DependencyTypeDialogProps {
    workflowId: Workflow.Id
    onSelect: DependencySelectorOptions['onSelect']
}

const DependencyTypeDialog = ({ workflowId, onSelect }: DependencyTypeDialogProps) => {

    const dialogId = getDependencyTypeDialogId(workflowId)

    const [kind, setKind] = useState<LocalWorkflowKind>("draftWorkflow")

    const [isAttaching, setIsAttaching] = useState(false)

    const [deployedPublication, [request]] = VersionControlSDK.useWith(
        (s) => s.deployments[workflowId],
        (q) => [q.deployment(workflowId)],
    )

    const hasPublication = Boolean(deployedPublication)

    const handleAttach = async () => {
        setIsAttaching(true)

        const success = await onSelect({ kind, id: workflowId })

        setIsAttaching(false)

        if (!success)
            return

        DialogSDK.actions.pop(dialogId)
        DialogSDK.actions.pop(DEPENDENCY_SELECTOR_DIALOG_ID)
    }

    return (
        <div className='p-2 w-[400px] h-[250px] flex flex-col gap-2'>
            <Dialog.Title>Attach workflow</Dialog.Title>
            <Dialog.Description></Dialog.Description>
            {request.isPending ? (
                <div className='flex items-center justify-center gap-2 py-10 text-xs text-muted-foreground'>
                    <Spinner className='size-3.5' />
                    Checking publications
                </div>
            ) : (
                <>
                    <Tabs.Root value={kind} onValueChange={(val) => setKind(val as LocalWorkflowKind)}>
                        <Tabs.List size="lg" className='w-full'>
                            <Tabs.Trigger value='draftWorkflow' className='w-1/2 flex flex-col gap-2'>
                                <SystemIcons.DraftingCompass className='size-10' />
                                Draft
                            </Tabs.Trigger>
                            <Tabs.Trigger value="publishedWorkflow" className='w-1/2 flex flex-col gap-2' disabled={!hasPublication}>
                                <SystemIcons.ShieldCheck className='size-10' />
                                <div className='flex flex-row gap-2'>
                                    Published
                                    {deployedPublication &&
                                        <Badge variant="success" className='h-auto my-auto'>
                                            {deployedPublication.name}
                                        </Badge>
                                    }
                                </div>
                            </Tabs.Trigger>
                        </Tabs.List>
                    </Tabs.Root>
                    <p className='px-1 text-xs text-muted-foreground'>
                        {kindDescriptions[kind]}
                    </p>
                    <Dialog.Action className="mt-auto" onClick={handleAttach} loading={isAttaching}>
                        Attach
                    </Dialog.Action>
                </>
            )}
        </div>
    )
}
