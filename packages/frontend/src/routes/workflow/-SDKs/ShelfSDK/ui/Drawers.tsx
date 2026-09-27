import React, { memo, useEffect, useState } from 'react'
import { ShelfSDK } from '../sdk'
import { Shelf } from "@pretzel-graph/shared/domain";
import { Skeleton, Spinner } from '@pretzel-graph/standard-ui/foundations';
import { useShallow } from 'zustand/react/shallow';
import { SystemIcons } from '@pretzel-graph/standard-ui/icons';
import DrawerItem from './DrawerItem';
import { IconRenderer } from '@pretzel-graph/standard-ui/icons/IconRenderer';


const DRAWER_SKELETONS = ['w-24', 'w-32', 'w-20', 'w-28', 'w-24', 'w-36', 'w-20', 'w-28']

export const Drawers = () => {

    const selectedSection = ShelfSDK.useStore(s => s.selectedSection);

    const [filteredDrawers, [request]] = ShelfSDK.useWith(useShallow(s => {
        if (s.loadedSections.has(s.selectedSection) === false)
            return undefined;

        const drawerIds = s.sections[s.selectedSection]

        if (s.searchFilter.query === "" || !s.searchFilter.query)
            return drawerIds.map(id => s.drawers[id])

        return Object.values(s.filteredDrawers)
    }), (q) => [q.section(selectedSection)])

    if (filteredDrawers === undefined && request.isError)
        return <DrawersError />

    if (filteredDrawers === undefined)
        return <DrawersSkeleton />

    return (
        <div className='flex flex-col gap-1 w-full p-2'>
            {filteredDrawers.map(drawer => {
                if (drawer.blueprintIds.length === 0)
                    return;

                return <Drawer drawer={drawer} key={drawer.id} />
            })}
        </div>
    )
}

const DrawersSkeleton = () => (
    <div className='flex flex-col gap-1 w-full p-2'>
        {DRAWER_SKELETONS.map((width, index) => (
            <div className='flex flex-row items-center gap-2 h-8 px-2' key={index}>
                <Skeleton className='size-4 shrink-0 rounded-sm' />
                <Skeleton className={`h-3 ${width}`} />
            </div>
        ))}
    </div>
)

const DrawersError = () => (
    <div className='flex flex-col items-center gap-1 w-full p-4 text-center'>
        <SystemIcons.AlertTriangle className='size-5 text-destructive' />
        <p className='text-sm font-medium text-foreground'>Could not load nodes</p>
        <p className='text-xs text-muted-foreground'>The server might be restarting.</p>
    </div>
)

export default Drawers

interface Props extends React.HTMLAttributes<HTMLDivElement> {
    drawer: Shelf.Drawer
}


const CLOSE_MS = 300;
const ITEM_H = 32;      // h-8
const GAP = 4;          // gap-1
const PADDING_Y = 8 // py-1

const Drawer: React.FC<Props> = memo(({ drawer }) => {
    const isOpen = ShelfSDK.useStore(s => s.openedDrawers.has(drawer.id));

    const [shouldRender, setShouldRender] = useState(isOpen);

    useEffect(() => {
        if (isOpen) {
            if (shouldRender === false)
                setShouldRender(true);
            return;
        }

        if (shouldRender === false)
            return

        const t = window.setTimeout(() => setShouldRender(false), CLOSE_MS);
        return () => window.clearTimeout(t);
    }, [isOpen]);

    if (!drawer || drawer.blueprintIds?.length === 0) return;

    const count = drawer.blueprintIds?.length ?? 0;
    const contentMaxH = count > 0 ? count * ITEM_H + (count - 1) * GAP + PADDING_Y : 0;


    const isFetchingNodeDefinitions = shouldRender && !!!drawer.blueprintIds;

    return (
        <div className='flex flex-col h-fit'>
            <div
                className='flex flex-row gap-2 h-8 px-2 cursor-pointer hover:bg-primary/40 rounded-lg'
                onClick={() => ShelfSDK.actions.drawer.toggle(drawer.id)}
            >
                <IconRenderer name={drawer.icon} className={`min-w-4 size-4 h-4 my-auto ${isOpen ? "text-primary" : ""}`} />
                <p className='text-sm font-medium text-card-foreground my-auto w-full text-left! select-none'>
                    {drawer.displayName}
                </p>
                {
                    isFetchingNodeDefinitions === false ?
                        <SystemIcons.ChevronRight className={`h-4 w-4 stroke-3! stroke-label-white m-auto transition-transform duration-300 ${isOpen ? "rotate-90" : ""}`} />
                        :
                        <Spinner className='my-auto mr-1' />
                }
            </div>

            {/* Content */}
            <div className="transition-[max-height,opacity] duration-300 ease-in-out"
                style={{
                    maxHeight: isOpen ? contentMaxH : 0,
                    opacity: isOpen ? 1 : 0
                }}
            >
                <div className=' flex flex-col gap-1 py-1'>
                    {shouldRender && drawer.blueprintIds.map(blueprintId => (
                        <DrawerItem blueprintId={blueprintId} key={blueprintId} />
                    ))}
                </div>
            </div>
        </div>
    )
})
