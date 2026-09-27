import { useMemo } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Button, AlertDialog, ScrollArea, Skeleton } from '@pretzel-graph/standard-ui/foundations'
import { SystemIcons } from '@pretzel-graph/standard-ui/icons'
import { IconRenderer } from '@pretzel-graph/standard-ui/icons/IconRenderer'
import { VaultSDK } from '@/SDKs/VaultSDK/sdk'
import { DialogSDK } from '@pretzel-graph/standard-ui/SDKs/DialogSDK'
import { CredentialFormDialog } from '@/SDKs/VaultSDK/ui/CredentialForm'
import type { Vault } from '@pretzel-graph/shared/domain'


export const Route = createFileRoute('/home/credentials')({
    component: CredentialsRoute,
})


type Group = {
    templateId: Vault.Credential.Template.Id
    template?: Vault.Credential.Template
    instances: Vault.Credential.Instance[]
}

function CredentialsRoute() {
    const [instances, [instancesRequest]] = VaultSDK.useWith(
        (s) => s.credentialInstances,
        (q) => [q.instances],
    )

    const templateIds = useMemo(
        () => [...new Set(Object.values(instances).map(i => i.template_id))],
        [instances],
    )

    const [templates, [templatesRequest]] = VaultSDK.useWith(
        (s) => s.credentialTemplates,
        (q) => [q.templates(templateIds)],
    )

    const groups = useMemo<Group[]>(() => {
        const byTemplate = new Map<Vault.Credential.Template.Id, Vault.Credential.Instance[]>()

        for (const instance of Object.values(instances)) {
            const list = byTemplate.get(instance.template_id) ?? []
            list.push(instance)
            byTemplate.set(instance.template_id, list)
        }

        return [...byTemplate.entries()]
            .map(([templateId, list]) => ({
                templateId,
                template: templates[templateId],
                instances: list.sort((a, b) => a.name.localeCompare(b.name)),
            }))
            .sort((a, b) =>
                (a.template?.displayName ?? a.templateId).localeCompare(b.template?.displayName ?? b.templateId),
            )
    }, [instances, templates])

    const isLoadingInstances = instancesRequest.isPending && groups.length === 0
    const isLoadingTemplates = templatesRequest.isLoading && groups.some(group => !group.template)

    if (isLoadingInstances || isLoadingTemplates)
        return <CredentialsSkeleton />

    if (groups.length === 0)
        return <EmptyState />

    return (
        <div className='flex flex-col gap-2 pb-10 pt-[60px] pr-10 pl-2'>
            {groups.map(group => (
                <TemplateGroup key={group.templateId} group={group} />
            ))}
        </div>
    )
}


const GROUP_SKELETONS = [0, 1, 2]
const ROW_SKELETONS = [0, 1]

function CredentialsSkeleton() {
    return (
        <div className='flex flex-col gap-2 pb-10 pt-[60px] pr-10 pl-2'>
            {GROUP_SKELETONS.map(groupIndex => (
                <div key={groupIndex} className='flex flex-col'>
                    <div className='flex items-center gap-2 px-3 py-2'>
                        <Skeleton className='size-4 rounded-sm' />
                        <Skeleton className='h-4 w-32' />
                        <Skeleton className='h-3 w-3' />
                        <Skeleton className='ml-auto h-8 w-16' />
                    </div>
                    <div className='flex flex-col'>
                        {ROW_SKELETONS.map(rowIndex => (
                            <div key={rowIndex} className='flex items-center gap-3 px-3 py-2 border-t border-border/40 first:border-t-0'>
                                <Skeleton className='h-4 w-40' />
                                <Skeleton className='ml-auto h-3 w-16' />
                                <div className='flex gap-1'>
                                    <Skeleton className='size-6' />
                                    <Skeleton className='size-6' />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    )
}


function TemplateGroup({ group }: { group: Group }) {
    const { template, templateId, instances } = group

    const openAddDialog = () => {
        if (!template)
            return

        const dialogId = `add-credential-${templateId}`
        DialogSDK.actions.push(dialogId, props => (
            <CredentialFormDialog
                {...props}
                credentialTemplate={template}
                onCreated={() => DialogSDK.actions.pop(dialogId)}
            />
        ))
    }

    return (
        <div className='flex flex-col'>
            <div className='flex items-center gap-2 px-3 py-2'>
                {template?.icon
                    ? <IconRenderer name={template.icon} className='size-4' />
                    : <SystemIcons.KeyRound size={16} className='opacity-60' />
                }
                <span className='text-sm font-medium'>{template?.displayName ?? templateId}</span>
                <span className='text-xs text-muted-foreground'>{instances.length}</span>

                {template && (
                    <Button variant={"input"} size='sm' className='ml-auto' onClick={openAddDialog}>
                        <SystemIcons.Plus /> Add
                    </Button>
                )}
            </div>
            <div className='flex flex-col'>
                {instances.map(instance => (
                    <CredentialRow key={instance.id} instance={instance} template={template} />
                ))}
            </div>
        </div>
    )
}


function CredentialRow({ instance, template }: { instance: Vault.Credential.Instance, template?: Vault.Credential.Template }) {

    const openEditDialog = () => {
        if (!template)
            return

        const dialogId = `edit-credential-${instance.id}`
        DialogSDK.actions.push(dialogId, props => (
            <CredentialFormDialog
                {...props}
                credentialTemplate={template}
                updateProps={{
                    instanceId: instance.id,
                    onUpdateComplete: () => DialogSDK.actions.pop(dialogId),
                    onRemoved: () => DialogSDK.actions.pop(dialogId),
                }}
            />
        ))
    }

    const openDeleteDialog = () => {
        const dialogId = `delete-credential-${instance.id}`
        DialogSDK.actions.push(dialogId, props => (
            <DialogSDK.AlertTemplate
                {...props}
                type='danger'
                onApprove={async () => {
                    await VaultSDK.actions.instance.remove(instance.id)
                    DialogSDK.actions.pop(dialogId)
                }}
                onCancel={() => DialogSDK.actions.pop(dialogId)}
            >
                <AlertDialog.Title>Are you sure?</AlertDialog.Title>
                <AlertDialog.Description>
                    Deleting <span className='font-semibold text-destructive'>{instance.name}</span> cannot be undone.
                    Workflows using this credential will stop working.
                </AlertDialog.Description>
            </DialogSDK.AlertTemplate>
        ))
    }

    return (
        <div className='flex items-center gap-3 px-3 py-2 border-t border-border/40 first:border-t-0'>
            <span className='text-sm flex-1 truncate'>{instance.name}</span>

            <span className='text-xs text-muted-foreground shrink-0'>
                {new Date(instance.updated_at).toLocaleDateString()}
            </span>

            <div className='flex gap-1 shrink-0'>
                <Button variant='ghost' size='icon-xs' onClick={openEditDialog} disabled={!template}>
                    <SystemIcons.SquarePen />
                </Button>
                <Button variant='ghost' size='icon-xs' className='text-destructive' onClick={openDeleteDialog}>
                    <SystemIcons.Trash />
                </Button>
            </div>
        </div>
    )
}


function EmptyState() {
    return (
        <div className='flex flex-col items-center justify-center py-20 text-center opacity-70'>
            <SystemIcons.KeyRound size={32} className='mb-3' />
            <p className='text-sm'>You don't have any credentials yet.</p>
            <p className='text-xs opacity-60 mt-1'>Add one from a node's settings panel in the editor.</p>
        </div>
    )
}
