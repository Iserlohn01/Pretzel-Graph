import { LibrarySDK } from '@/SDKs/LibrarySDK/sdk'
import { SystemIcons } from '@pretzel-graph/standard-ui/icons'
import { ContextMenu } from '@pretzel-graph/standard-ui/foundations'
import { Library } from '@pretzel-graph/shared/domain'
import { OpenInSubMenu } from './open-in'
import { toast } from 'sonner'

interface Props {
    folder: Library.Folder
    onOpen?: () => void
}

export function FolderMenuItems({ folder, onOpen }: Props) {
    const isRoot = folder.id === Library.Folder.ROOT_ID

    return (
        <>
            {onOpen && (
                <ContextMenu.Item
                    icon={<SystemIcons.FolderOpen className='size-4' />}
                    onClick={onOpen}
                >
                    Open here
                </ContextMenu.Item>
            )}
            
            <OpenInSubMenu url={`/home/library/${folder.id}`} />
            <ContextMenu.Separator />
            {!isRoot && (
                <ContextMenu.Item
                    icon={<SystemIcons.ArrowRight className='size-4' />}
                    onClick={() => openMoveFolder(folder)}
                >
                    Move to…
                </ContextMenu.Item>
            )}
            <ContextMenu.Separator />
            <ContextMenu.Item
                icon={<SystemIcons.SquarePen className='size-4' />}
                onClick={() => LibrarySDK.dialogs.openEditFolder({ folder })}
            >
                Edit
            </ContextMenu.Item>
            <ContextMenu.Item
                icon={<SystemIcons.Copy className='size-4' />}
                onClick={() => navigator.clipboard.writeText(folder.id)}
            >
                Copy ID
            </ContextMenu.Item>
  
            {!isRoot && (
                <ContextMenu.Item
                    icon={folder.hidden ? <SystemIcons.Eye className='size-4' /> : <SystemIcons.EyeOff className='size-4' />}
                    onClick={() => LibrarySDK.actions.folder.setHidden(folder.id, !folder.hidden)}
                >
                    {folder.hidden ? 'Unhide' : 'Hide'}
                </ContextMenu.Item>
            )}
            {!isRoot && (
                <>
                    <ContextMenu.Separator />
                    <ContextMenu.Item
                        variant='destructive'
                        icon={<SystemIcons.Trash2 className='size-4' />}
                        onClick={() => LibrarySDK.dialogs.openDeleteFolder(folder)}
                    >
                        Delete
                    </ContextMenu.Item>
            
        </>
                )}
        </>
    )
}

export function NewSubMenu({ folderId }: { folderId: Library.Folder.Id }) {
    return (
        <ContextMenu.Sub>
            <ContextMenu.SubTrigger icon={<SystemIcons.Plus className='size-4' />}>
                New
            </ContextMenu.SubTrigger>
            <ContextMenu.SubContent>
                <ContextMenu.Item
                    icon={<SystemIcons.Folder className='size-4' />}
                    onClick={() => LibrarySDK.dialogs.openCreateFolder({ parent_folder_id: folderId })}
                >
                    Folder
                </ContextMenu.Item>
                <ContextMenu.Item
                    icon={<SystemIcons.Graph className='size-4' />}
                    onClick={() => LibrarySDK.dialogs.openTemplateGallery({ folder_id: folderId })}
                >
                    Workflow
                </ContextMenu.Item>
                <ContextMenu.Item
                    icon={<SystemIcons.Sparkles2 className='size-4' />}
                    onClick={() => LibrarySDK.dialogs.openCreateSkill({ folder_id: folderId })}
                >
                    Skill
                </ContextMenu.Item>
            </ContextMenu.SubContent>
        </ContextMenu.Sub>
    )
}

function openMoveFolder(folder: Library.Folder) {
    LibrarySDK.dialogs.openLibrarySelector({
        accept: 'folder',
        onSelect: async ({ id }) => {
            if (id === folder.parent_folder_id) return

            if (isSelfOrDescendant(id, folder.id)) {
                toast.error('A folder cannot be moved into itself')
                return
            }

            await LibrarySDK.actions.folder.move(folder.id, id)
            toast.success('Folder moved')
        },
    })
}

function isSelfOrDescendant(folderId: Library.Folder.Id, ancestorId: Library.Folder.Id) {
    const folders = LibrarySDK.state.folders

    let cursor: Library.Folder.Id | null = folderId

    while (cursor) {
        if (cursor === ancestorId) return true
        cursor = folders[cursor]?.parent_folder_id ?? null
    }

    return false
}
