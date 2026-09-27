import { memo } from 'react'
import { Button } from '@pretzel-graph/standard-ui/foundations'
import { cn } from '@pretzel-graph/standard-ui/utils/cn'
import { SystemIcons } from '@pretzel-graph/standard-ui/icons'
import { IconRenderer } from '@pretzel-graph/standard-ui/icons/IconRenderer'
import type { Foundations, Library, Workflow } from '@pretzel-graph/shared/domain'
import { LibrarySDK } from '@/SDKs/LibrarySDK/sdk'
import { GatewaySDK } from '@/SDKs/GatewaySDK/sdk'
import { ConnectionDot } from '@/SDKs/GatewaySDK/ui/ConnectionStatus'
import { WorkbenchSDK } from '../../sdk'
import { FieldLabel } from './FieldLabel'
import type { RendererProps } from './FieldLabel'

const NOUNS: Record<Library.Ref.Kind, string> = {
    workflow:   'workflow',
    folder:     'folder',
    skill:      'skill',
    connection: 'connection',
}

const ICONS: Record<Library.Ref.Kind, string> = {
    workflow:   'Graph',
    folder:     'Folder',
    skill:      'Sparkles2',
    connection: 'GatewayConnection',
}

// "a workflow", "a workflow or a skill", "an item" once it accepts everything.
const acceptedNoun = (accepts: Library.Ref.Kind[]) => {
    if (accepts.length === 0 || accepts.length === Object.keys(NOUNS).length)
        return 'an item'

    const nouns = accepts.map(kind => NOUNS[kind])

    return `a ${nouns.join(' or a ')}`
}

const openSelector = (nodeId: Workflow.Node.Id, field: Foundations.Field.LibraryRef) => {
    LibrarySDK.dialogs.openLibrarySelector({
        accept:       field.accepts,
        definitionId: field.definitionId,
        initialCwd:   LibrarySDK.selectors.folderOf(WorkbenchSDK.document.workflowId),
        onSelect:     (item) => WorkbenchSDK.actions.field.setValue(nodeId, field, { kind: item.type, id: item.id } as Library.Ref),
    })
}

export const LibraryRefField = memo<RendererProps<'LibraryRef'>>(({ field, nodeId, className }) => {

    const [value, , , issue] = WorkbenchSDK.useField<Library.Ref | null>(nodeId, field)

    const target = useTarget(value, field.definitionId)

    const errorClass = issue ? 'border-2 border-destructive animate-border-ping focus-visible:ring-destructive/50' : ''

    return (
        <div className={cn(className, 'w-full nodrag cursor-auto flex flex-col gap-1')}>
            <FieldLabel field={field} />
            <Button
                type='button'
                variant='outline'
                size='sm'
                className={cn('h-auto bg-card/80! min-h-7 w-full px-2 py-1 text-left', errorClass)}
                onClick={() => openSelector(nodeId, field)}
            >
                <span className='flex min-w-0 items-center gap-2 mr-auto'>
                    <span className='flex size-5 shrink-0 items-center justify-center rounded-full bg-muted'>
                        <IconRenderer name={target.icon} className='size-3' />
                    </span>
                    <span className='min-w-0 flex flex-col'>
                        <span className='truncate text-xs font-medium'>
                            {target.name ?? `Select ${acceptedNoun(field.accepts)}`}
                        </span>
                    </span>
                </span>
                {target.status && <ConnectionDot status={target.status} className='my-auto' />}
                <SystemIcons.ChevronDown />
            </Button>
        </div>
    )
})
LibraryRefField.displayName = 'LibraryRefField'

// What the ref points at right now: its name, its icon, and a connection's status.
function useTarget(value: Library.Ref | null, definitionId?: Foundations.Field.LibraryRef['definitionId']) {
    // The editor route loads workflows and skills; connections come from the gateway.
    const [[connection, definitionIcon]] = GatewaySDK.useWith(
        s => [
            value?.kind === 'connection' ? s.connections[value.id] : undefined,
            definitionId ? s.definitions[definitionId]?.icon : undefined,
        ] as const,
        (q) => [q.connections, q.definitions],
    )

    const libraryName = LibrarySDK.useStore(s => {
        switch (value?.kind) {
            case 'workflow':
                return s.workflowMetas[value.id]?.display_name

            case 'folder':
                return s.folders[value.id]?.display_name

            case 'skill':
                return s.skillMetas[value.id]?.name

            default:
                return undefined
        }
    })

    if (!value)
        return { name: undefined, icon: definitionIcon ?? 'Graph', status: undefined }

    if (value.kind === 'connection')
        return {
            name:   connection?.name ?? 'Missing connection',
            icon:   definitionIcon ?? ICONS.connection,
            status: connection?.status,
        }

    return { name: libraryName ?? `Missing ${NOUNS[value.kind]}`, icon: ICONS[value.kind], status: undefined }
}
