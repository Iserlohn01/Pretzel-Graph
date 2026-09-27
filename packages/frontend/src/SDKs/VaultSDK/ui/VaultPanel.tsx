import { useEffect, useState } from 'react'
import { VaultSDK } from '../sdk'
import {
    Button,
    Input,
    AlertDialog,
} from '@pretzel-graph/standard-ui/foundations'
import { Vault } from '@pretzel-graph/shared/domain'
import { DialogSDK } from '@pretzel-graph/standard-ui/SDKs/DialogSDK'
import { SystemIcons } from '@pretzel-graph/standard-ui/icons'
import { VaultGlyph } from '@pretzel-graph/standard-ui/brands/vaultGlyph'

const VaultPanel = () => {
    const [instances] = VaultSDK.useWith(
        (s) => Object.values(s.credentialInstances),
        (q) => [q.instances],
    )

    return (
        <div className='flex flex-col h-full w-full p-4 gap-4 min-w-[600px]'>
            <div className='flex flex-row w-full gap-3 items-center'>
                <VaultGlyph className='size-10 shrink-0' />
                <h1 className='text-lg font-bold'>VAULT</h1>
            </div>

            <p className='text-sm text-muted-foreground'>
                Manage your API keys and secrets. Add credentials from a node's settings panel.
            </p>

            <div className='flex flex-col gap-2 bg-input/50 rounded-md border border-border shadow-md shadow-black/10'>
                {instances.length === 0 ? (
                    <div className='flex flex-col bg-background items-center justify-center p-8 border border-dashed rounded-md gap-2'>
                        <SystemIcons.KeyRound className='h-8 w-8 text-muted-foreground' />
                        <p className='text-sm text-muted-foreground'>No credentials yet. Add one from a node's settings.</p>
                    </div>
                ) : (
                    instances.map(instance => (
                        <CredentialItem key={instance.id} instance={instance} />
                    ))
                )}
            </div>

            <p className='text-sm text-muted-foreground'>{instances.length} credential{instances.length !== 1 ? 's' : ''} stored</p>
        </div>
    )
}

export default VaultPanel

const CredentialItem = ({ instance }: { instance: Vault.Credential.Instance }) => {
    const [localName, setLocalName] = useState(instance.name)
    const [isLoading, setIsLoading] = useState(false)

    useEffect(() => {
        setLocalName(instance.name)
    }, [instance.name])

    const isDirty = localName !== instance.name

    const handleSave = async () => {
        setIsLoading(true)
        try {
            await VaultSDK.actions.instance.update.name(instance.id, localName)
        } finally {
            setIsLoading(false)
        }
    }

    const handleUndo = () => setLocalName(instance.name)

    const handleDelete = () => {
        DialogSDK.actions.push(`delete-credential-${instance.id}`, props => (
            <DialogSDK.AlertTemplate
                {...props}
                type='danger'
                onApprove={async () => {
                    await VaultSDK.actions.instance.remove(instance.id)
                    DialogSDK.actions.pop(`delete-credential-${instance.id}`)
                }}
                onCancel={() => DialogSDK.actions.pop(`delete-credential-${instance.id}`)}
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
        <div className='flex flex-row w-full px-3 py-2 gap-4 items-center'>
            <span className='text-xs text-muted-foreground w-32 shrink-0 truncate'>{instance.template_id}</span>
            <Input
                value={localName}
                onChange={e => setLocalName(e.target.value)}
                className='text-xs border-none rounded-sm px-1 py-0.5 h-auto my-auto bg-transparent! flex-1'
            />
            <div className='flex flex-row gap-1'>
                {isDirty ? (
                    <>
                        <Button variant='ghost' size='icon' onClick={handleUndo} disabled={isLoading}>
                            <SystemIcons.X className='text-red-500' />
                        </Button>
                        <Button variant='ghost' size='icon' onClick={handleSave} disabled={isLoading}>
                            <SystemIcons.Check className='text-green-500' />
                        </Button>
                    </>
                ) : (
                    <Button variant='ghost' size='icon' onClick={handleDelete} disabled={isLoading}>
                        <SystemIcons.Trash className='text-red-500' />
                        <span className='sr-only'>Delete</span>
                    </Button>
                )}
            </div>
        </div>
    )
}
