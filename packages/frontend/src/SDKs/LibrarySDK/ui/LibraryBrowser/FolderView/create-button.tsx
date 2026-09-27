import { Button, DropdownMenu } from '@pretzel-graph/standard-ui/foundations'
import type { ButtonProps } from '@pretzel-graph/standard-ui/foundations/button'
import { SystemIcons } from '@pretzel-graph/standard-ui/icons'
import { LibrarySDK } from '@/SDKs/LibrarySDK/sdk'
import { GatewaySDK } from '@/SDKs/GatewaySDK/sdk'
import { IconRenderer } from '@pretzel-graph/standard-ui/icons/IconRenderer'
import { useLibraryBrowser } from '../root'

type Props = {
    size?: ButtonProps['size']
    triggerClassName?: string
}

export const CreateBtn = ({ size, triggerClassName }: Props) => {
    const { cwd } = useLibraryBrowser()

    const [definitions] = GatewaySDK.useWith(
        s => Object.values(s.definitions),
        (q) => [q.definitions],
    )

    return (
        <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
                <Button size={size} className={triggerClassName}>
                    Create
                </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="end">
                <DropdownMenu.Item
                    onClick={() => LibrarySDK.dialogs.openCreateFolder({ parent_folder_id: cwd })}
                ><SystemIcons.Folder />Folder</DropdownMenu.Item>

                <DropdownMenu.Item
                    onClick={() => LibrarySDK.dialogs.openCreateWorkflow({ folder_id: cwd })}
                ><SystemIcons.Graph />Workflow</DropdownMenu.Item>

                <DropdownMenu.Item
                    onClick={() => LibrarySDK.dialogs.openCreateSkill({ folder_id: cwd })}
                ><SystemIcons.Sparkles2 />Skill</DropdownMenu.Item>

                <DropdownMenu.Sub>
                    <DropdownMenu.SubTrigger><SystemIcons.GatewayConnection />Connection</DropdownMenu.SubTrigger>
                    <DropdownMenu.SubContent>
                        {definitions.length === 0 ? (
                            <DropdownMenu.Item disabled>No connection types</DropdownMenu.Item>
                        ) : definitions.map(definition => (
                            <DropdownMenu.Item
                                key={definition.id}
                                onClick={() => LibrarySDK.dialogs.openCreateConnection({ folder_id: cwd, definition })}
                            ><IconRenderer name={definition.icon} className='size-4' />{definition.displayName}</DropdownMenu.Item>
                        ))}
                    </DropdownMenu.SubContent>
                </DropdownMenu.Sub>
            </DropdownMenu.Content>
        </DropdownMenu.Root>
    )
}
