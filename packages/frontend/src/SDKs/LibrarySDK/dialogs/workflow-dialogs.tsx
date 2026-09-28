import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AlertDialog, Dialog, Form, Input } from '@pretzel-graph/standard-ui/foundations'
import { Switch } from '@pretzel-graph/standard-ui/foundations/switch'
import { SystemIcons } from '@pretzel-graph/standard-ui/icons'
import { DialogSDK } from '@pretzel-graph/standard-ui/SDKs/DialogSDK'
import { LibrarySDK } from '../sdk'
import { Workflow, type Library } from '@pretzel-graph/shared/domain'
import { toast } from 'sonner'
import { WorkflowIllustration } from '@pretzel-graph/standard-ui/icons/illustrations'

const DIALOG_CLASSNAME = 'sm:max-w-[480px] w-full'

const Schema = z.object({
    display_name: z.string().trim().min(1, 'Name is required'),
    description: z.string().trim().optional(),
    icon: z.string().trim().optional(),
    accent: z.string().trim().optional(),
})
type Values = z.infer<typeof Schema>

export function openCreateWorkflowDialog(args: { folder_id: Library.Folder.Id; onCreated?: (workflow: Workflow) => void }) {
    const id = `create-workflow-${args.folder_id}`
    DialogSDK.actions.push(id, (props) => (
        <DialogSDK.Template {...props} className={DIALOG_CLASSNAME}>
            <CreateWorkflowContent dialogId={id} {...args} />
        </DialogSDK.Template>
    ))
}

export function openEditWorkflowDialog(args: { workflow: Library.WorkflowMeta }) {
    const id = `edit-workflow-${args.workflow.id}`
    DialogSDK.actions.push(id, (props) => (
        <DialogSDK.Template {...props} className={DIALOG_CLASSNAME}>
            <EditWorkflowContent dialogId={id} workflow={args.workflow} />
        </DialogSDK.Template>
    ))
}

function CreateWorkflowContent({ dialogId, folder_id, onCreated }: { dialogId: string; folder_id: Library.Folder.Id; onCreated?: (workflow: Workflow) => void }) {
    const form = useForm<Values>({
        resolver: zodResolver(Schema),
        defaultValues: { display_name: '', description: '' },
    })

    const onSubmit = async (values: Values) => {
        try {
            const workflow = await LibrarySDK.actions.workflow.create({
                folder_id,
                display_name: values.display_name,
                description: values.description || null,
            })
            toast.success('Workflow created')
            DialogSDK.actions.pop(dialogId)
            onCreated?.(workflow)
        } catch (err) {
            console.error('Failed to create workflow', err)
            toast.error('Failed to create workflow')
        }
    }

    return (
        <div className="p-3 flex flex-col gap-4">
            <Dialog.Header className="my-1">
                <Dialog.Title className="flex items-center gap-2">
                    <WorkflowIllustration
                        color="var(--primary)" className="size-8 shrink-0" 
                    />
                    New workflow
                </Dialog.Title>
                <Dialog.Description className="text-muted-foreground">
                    Start a new workflow here.
                </Dialog.Description>
            </Dialog.Header>
            <Form.Root {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4" autoComplete="off">
                    <Form.Field control={form.control} name="display_name" render={({ field }) => (
                        <Form.Item>
                            <Form.Label>Name</Form.Label>
                            <Form.Control><Input {...field} placeholder="Untitled workflow" autoFocus /></Form.Control>
                            <Form.Message />
                        </Form.Item>
                    )} />
                    <Form.Field control={form.control} name="description" render={({ field }) => (
                        <Form.Item>
                            <Form.Label>Description</Form.Label>
                            <Form.Control><Input {...field} placeholder="Optional" /></Form.Control>
                            <Form.Message />
                        </Form.Item>
                    )} />
                    <Dialog.Footer>
                        <Dialog.Cancel>Cancel</Dialog.Cancel>
                        <Dialog.Action type="submit" loading={form.formState.isSubmitting}>
                            Create
                        </Dialog.Action>
                    </Dialog.Footer>
                </form>
            </Form.Root>
        </div>
    )
}

function EditWorkflowContent({ dialogId, workflow }: { dialogId: string; workflow: Library.WorkflowMeta }) {
    const form = useForm<Values>({
        resolver: zodResolver(Schema),
        defaultValues: {
            display_name: workflow.display_name || '',
            description: workflow.description || '',
            icon: workflow.icon || '',
            accent: workflow.accent || '',
        },
    })

    const onSubmit = async (values: Values) => {
        try {
            await LibrarySDK.actions.workflow.update({
                id: workflow.id,
                display_name: values.display_name,
                description: values.description || null,
                icon: values.icon || null,
                accent: values.accent || null,
            })
            toast.success('Workflow updated')
            DialogSDK.actions.pop(dialogId)
        } catch (err) {
            console.error('Failed to update workflow', err)
            toast.error('Failed to update workflow')
        }
    }

    return (
        <div className="p-3 flex flex-col gap-4">
            <Dialog.Header className="my-1">
                <Dialog.Title className="flex items-center gap-2">
                    <WorkflowIllustration
                        color="var(--primary)" className="size-8 shrink-0" 
                    />
                    Edit workflow
                </Dialog.Title>
                <Dialog.Description className="text-muted-foreground">
                    Update workflow metadata.
                </Dialog.Description>
            </Dialog.Header>
            <Form.Root {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4" autoComplete="off">
                    <Form.Field control={form.control} name="display_name" render={({ field }) => (
                        <Form.Item>
                            <Form.Label>Name</Form.Label>
                            <Form.Control><Input {...field} placeholder="Untitled workflow" autoFocus /></Form.Control>
                            <Form.Message />
                        </Form.Item>
                    )} />
                    <Form.Field control={form.control} name="description" render={({ field }) => (
                        <Form.Item>
                            <Form.Label>Description</Form.Label>
                            <Form.Control><Input {...field} placeholder="Optional" /></Form.Control>
                            <Form.Message />
                        </Form.Item>
                    )} />
                    <div className="grid grid-cols-2 gap-3">
                        <Form.Field control={form.control} name="icon" render={({ field }) => (
                            <Form.Item>
                                <Form.Label>Icon</Form.Label>
                                <Form.Control><Input {...field} placeholder={Workflow.DEFAULT_ICON} /></Form.Control>
                                <Form.Message />
                            </Form.Item>
                        )} />
                        <Form.Field control={form.control} name="accent" render={({ field }) => (
                            <Form.Item>
                                <Form.Label>Accent</Form.Label>
                                <Form.Control><Input {...field} placeholder={Workflow.DEFAULT_ACCENT} /></Form.Control>
                                <Form.Message />
                            </Form.Item>
                        )} />
                    </div>
                    <Dialog.Footer>
                        <Dialog.Cancel>Cancel</Dialog.Cancel>
                        <Dialog.Action type="submit" loading={form.formState.isSubmitting}>
                            Save
                        </Dialog.Action>
                    </Dialog.Footer>
                </form>
            </Form.Root>
        </div>
    )
}

export function openDeleteWorkflowDialog(workflow: Library.WorkflowMeta) {
    const dialogId = `delete-workflow-${workflow.id}`

    DialogSDK.actions.push(dialogId, (props) => (
        <DialogSDK.AlertTemplate
            {...props}
            type='danger'
            onApprove={async () => {
                await LibrarySDK.actions.workflow.delete(workflow.id)
                DialogSDK.actions.pop(dialogId)
            }}
            onCancel={() => DialogSDK.actions.pop(dialogId)}
        >
            <AlertDialog.Title>
                Delete workflow?
            </AlertDialog.Title>
            <AlertDialog.Description>
                This action is irreversible. Deleting <span className='font-semibold text-destructive'>{workflow.display_name || 'Untitled'}</span> cannot be undone.
            </AlertDialog.Description>
        </DialogSDK.AlertTemplate>
    ))
}
