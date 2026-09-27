import { useMemo, useState } from 'react'
import { Tree } from '@/components/Tree'
import { ScrollArea, Spinner } from '@pretzel-graph/standard-ui/foundations'
import type { FileSystemNodeData } from '../../../actions'
import { LibrarySDK } from '../../../sdk'
import { VersionControlSDK } from '@/SDKs/VersionControlSDK'
import type { LibraryBrowserBaseProps } from '..'
import { sizeStyles } from './sizes'
import { filterTree } from './utils'
import { TreeItem } from './tree-item'
import { LibraryContextMenu } from '../context-menus'
import { useDelay } from '@/hooks/useDelay'
import { useLibraryBrowser } from '../root'

interface Props extends LibraryBrowserBaseProps {
    scrollContainerClassName?: string
    className?: string
}

export const Content: React.FC<Props> = ({ scrollContainerClassName, size = 'default', selectedWorkflowId, className }) => {
    const styles = sizeStyles[size]

    const { cwd, setCwd, onItemClick, isItemDisabled, queryDelay, treeSearchQuery } = useLibraryBrowser()

    const isQueryReady = useDelay(queryDelay)

    const [treeData, [request]] = LibrarySDK.useWith(
        (s) => s.treeData,
        (q) => [{ ...q.bootstrap, enabled: isQueryReady }],
    )

    VersionControlSDK.useWith(() => null, (q) => [{ ...q.deployments, enabled: isQueryReady }])

    const query = treeSearchQuery.trim().toLowerCase()

    const displayTree = useMemo(
        () => (query ? filterTree(treeData, query) : treeData),
        [treeData, query],
    )

    const selectedFolderKey = cwd ? `folder:${cwd}` : undefined
    const selectedWorkflowKey = selectedWorkflowId ? `workflow:${selectedWorkflowId}` : undefined

    const hasContents = treeData.childBranches && Object.keys(treeData.childBranches).length > 0
    const hasResults = displayTree.childBranches && Object.keys(displayTree.childBranches).length > 0

    return (
        <LibraryContextMenu>
            <ScrollArea.Root className={"relative " + scrollContainerClassName}>
                {!hasContents && request.isPending ? (
                    <div className='flex justify-center py-10'>
                        <Spinner className='size-4' />
                    </div>
                ) : !hasContents ? (
                    <div className='text-sm opacity-60 px-2 py-1'>Nothing here yet.</div>
                ) : !hasResults ? (
                    <div className='text-sm opacity-60 px-2 py-1'>No matches.</div>
                ) : (
                    <Tree<FileSystemNodeData>
                        key={query || 'all'}
                        root={displayTree}
                        className={className}
                        renderBranch={(props) => (
                            <TreeItem
                                {...props}
                                isSelected={props.branch.key === selectedFolderKey || props.branch.key === selectedWorkflowKey}
                                styles={styles}
                                size={size}
                                onFolderClick={(id) => setCwd(id)}
                                onItemClick={onItemClick}
                                isItemDisabled={isItemDisabled}
                            />
                        )}
                    />
                )}
            </ScrollArea.Root>
        </LibraryContextMenu>
    )
}
