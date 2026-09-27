import { Library, type Gateway, type Skill } from "@pretzel-graph/shared/domain";
import React, { useMemo } from "react";
import { EmptyFolder } from "./empty-folder";
import classNames from "classnames";
import type { LibraryBrowserBaseProps } from "..";
import { LibrarySDK } from "@/SDKs/LibrarySDK/sdk";
import { VersionControlSDK } from "@/SDKs/VersionControlSDK";
import { ScrollArea, Skeleton } from "@pretzel-graph/standard-ui/foundations";
import { FolderItem } from "./items/folder";
import { WorkflowItem } from "./items/workflow";
import { SkillItem } from "./items/skill";
import { ConnectionItem } from "./items/connection";
import { GatewaySDK } from "@/SDKs/GatewaySDK/sdk";
import { sizeStyles as itemSizeStyles, type ItemSize } from "./items/sizes";
import { SystemIcons } from "@pretzel-graph/standard-ui/icons";
import { useLibraryBrowser } from "../root";
import { LibraryContextMenu } from "../context-menus";
import { useDelay } from "@/hooks/useDelay";

interface Props extends Pick<LibraryBrowserBaseProps, 'size'> {
    scrollContainerClassName?: string
    className?: string
}

const sizeStyles = {
    default: {
        heading: '',
        grid: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 ',
        breadCrumbs: ""
    },
    sm: {
        heading: 'text-xs',
        grid: 'grid-cols-3 gap-1',
        breadCrumbs: "text-xs!"
    },
} as const

const SKELETONS = [0, 1, 2, 3, 4, 5, 6, 7]

const skeletonTextStyles = {
    default: { name: 'h-3.5 w-20', meta: 'h-3 w-12' },
    sm:      { name: 'h-3 w-14',   meta: 'h-2.5 w-10' },
} as const

const ItemSkeleton = ({ size }: { size: ItemSize }) => (
    <div className={classNames('flex m-auto', itemSizeStyles[size].card)}>
        <div className='p-1 flex flex-col items-center gap-1.5 m-auto'>
            <Skeleton className={classNames('shrink-0 rounded-lg', itemSizeStyles[size].folderIcon)} />
            <Skeleton className={skeletonTextStyles[size].name} />
            <Skeleton className={skeletonTextStyles[size].meta} />
        </div>
    </div>
)

export const FolderViewSkeleton = ({ size = 'default', className }: { size?: ItemSize, className?: string }) => (
    <div className={className}>
        <Skeleton className='h-4 w-20 mb-2' />
        <div className={classNames('grid', sizeStyles[size].grid)}>
            {SKELETONS.map((index) => <ItemSkeleton key={index} size={size} />)}
        </div>
    </div>
)

export const Content: React.FC<Props> = ({ scrollContainerClassName, className, size = 'default' }) => {

    const { cwd, setCwd, onItemClick, isItemDisabled, queryDelay, searchQuery } = useLibraryBrowser()

    const isQueryReady = useDelay(queryDelay)

    const [[view, hasLibrary], [request]] = LibrarySDK.useWith(
        (s) => [s.selectors.getLibraryView(s, cwd), Library.Folder.ROOT_ID in s.folders] as const,
        (q) => [{ ...q.bootstrap, enabled: isQueryReady }],
    )

    VersionControlSDK.useWith(() => null, (q) => [{ ...q.deployments, enabled: isQueryReady }])

    const [connections] = GatewaySDK.useWith(
        (s) => GatewaySDK.selectors.byFolderId(s, cwd),
        (q) => [
            { ...q.connections, enabled: isQueryReady },
            { ...q.definitions, enabled: isQueryReady },
        ],
    )

    const query = searchQuery ? searchQuery.trim().toLowerCase() : ""

    const filteredFolders = useMemo(() => view.folders.filter(f => matchesQuery(f, query)), [view.folders, query])
    const filteredWorkflows = useMemo(() => view.worfklows.filter(w => matchesQuery(w, query)), [view.worfklows, query])
    const filteredSkills = useMemo(() => view.skills.filter(k => matchesSkill(k, query)).sort((a, b) => a.name.localeCompare(b.name)), [view.skills, query])
    const filteredConnections = useMemo(() => connections.filter(c => matchesConnection(c, query)).sort((a, b) => a.name.localeCompare(b.name)), [connections, query])

    const styles = sizeStyles[size]

    const itemProps = (item: LibrarySDK.Item) => ({
        disabled: isItemDisabled?.(item) ?? false,
        onClick:  () => onItemClick?.(item),
    })

    const isEmpty = filteredFolders.length === 0 && filteredWorkflows.length === 0 && filteredSkills.length === 0 && filteredConnections.length === 0;
    const hasNoMatches = !isEmpty && filteredFolders.length === 0 && filteredWorkflows.length === 0

    return (
        <LibraryContextMenu>
            <ScrollArea.Root className={"relative flex-1 mt-0! gap-2 flex flex-col " + scrollContainerClassName }>
                {!hasLibrary && request.isPending ? (
                    <FolderViewSkeleton size={size} className={className} />
                ) : isEmpty ? (
                    <EmptyFolder />
                ) : (
                    <div className={className}>
                        {filteredFolders.length > 0 &&
                            <h4 className={styles.heading}>
                                {filteredFolders.length} Folder
                                {filteredFolders.length === 1 ? "" : "s"}
                            </h4>
                        }
                        <div className={classNames('grid', styles.grid)}>
                            {filteredFolders.map((f) => (
                                <FolderItem key={f.id} folder={f} size={size} onClick={() => setCwd(f.id)} />
                            ))}
                        </div>
                        {filteredWorkflows.length > 0 &&
                            <h4 className={styles.heading}>
                                {filteredWorkflows.length} Workflow
                                {filteredWorkflows.length === 1 ? "" : "s"}
                            </h4>
                        }
                        <div className={classNames('grid', styles.grid)}>
                            {filteredWorkflows.map((w) => (
                                <WorkflowItem key={w.id} workflow={w} size={size} {...itemProps({ type: 'workflow', id: w.id })} />
                            ))}
                        </div>
                        {filteredSkills.length > 0 &&
                            <h4 className={styles.heading}>
                                {filteredSkills.length} Skill
                                {filteredSkills.length === 1 ? "" : "s"}
                            </h4>
                        }
                        <div className={classNames('grid', styles.grid)}>
                            {filteredSkills.map((k) => (
                                <SkillItem key={k.id} skill={k} size={size} {...itemProps({ type: 'skill', id: k.id })} />
                            ))}
                        </div>
                        {filteredConnections.length > 0 &&
                            <h4 className={styles.heading}>
                                {filteredConnections.length} Connection
                                {filteredConnections.length === 1 ? "" : "s"}
                            </h4>
                        }
                        <div className={classNames('grid', styles.grid)}>
                            {filteredConnections.map((c) => (
                                <ConnectionItem key={c.id} connection={c} size={size} {...itemProps({ type: 'connection', id: c.id })} />
                            ))}
                        </div>
                    </div>
                )}
            </ScrollArea.Root>
        </LibraryContextMenu>
    );
};


function matchesQuery(item: { id: string, display_name: string }, query: string) {
    if (!query) return true

    return item.display_name.toLowerCase().includes(query) || item.id.toLowerCase().includes(query)
}

function matchesSkill(skill: Skill.Meta, query: string) {
    if (!query) return true

    return skill.name.includes(query) || skill.description.toLowerCase().includes(query) || skill.id.includes(query)
}

function matchesConnection(connection: Gateway.Connection, query: string) {
    if (!query) return true

    return connection.name.toLowerCase().includes(query) || connection.id.includes(query)
}

function NoMatches({ query }: { query: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-20 text-center opacity-70">
            <SystemIcons.Search size={32} className="mb-3" />
            <p className="text-sm">No results for "{query}".</p>
        </div>
    )
}
