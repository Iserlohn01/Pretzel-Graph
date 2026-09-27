import { Kanban } from '@pretzel-graph/standard-ui/components/kanban'
import { Frame, Skeleton } from '@pretzel-graph/standard-ui/foundations'
import { useMemo } from 'react'
import { ActivitySDK } from '../sdk'
import type { Execution, Workflow } from '@pretzel-graph/shared/domain'
import WorkflowColumn from './WorkflowColumn'


/**
 * What a column shows first. Paused and suspended sit with running — all three
 * have not finished — and terminated joins the settled runs.
 */
const STATUS_TIER = {
    running: 0,
    paused: 0,
    suspended: 0,
    pending: 1,
    completed: 2,
    failed: 2,
    terminated: 2,
} satisfies Record<Execution.Status, number>

const SETTLED = 2

/** Settled runs are ordered by when they finished, the rest by when they started. */
const byActivity = (a: Execution.Meta, b: Execution.Meta) => {
    const tier = STATUS_TIER[a.status] - STATUS_TIER[b.status]

    if (tier !== 0)
        return tier

    const stamp = (execution: Execution.Meta) =>
        Date.parse(STATUS_TIER[execution.status] === SETTLED ? execution.updated_at : execution.created_at)

    return stamp(b) - stamp(a)
}


const COLUMN_SKELETONS = [0, 1, 2, 3, 4, 5, 6, 7]
const ITEM_SKELETONS = [0, 1, 2, 3, 4]

const ActivityKanbanSkeleton = () => (
    <div className='flex [&>*]:w-[260px] [&>*]:shrink-0'>
        {COLUMN_SKELETONS.map((columnIndex) => (
            <Frame.Root key={columnIndex} spacing='sm' className='p-2 gap-2'>
                <Frame.Header className='flex flex-row px-2 pt-0! items-center gap-2'>
                    <Skeleton className='size-4 rounded-sm' />
                    <Skeleton className='h-3 w-24' />
                </Frame.Header>
                <div className='flex flex-col gap-2'>
                    {ITEM_SKELETONS.map((itemIndex) => (
                        <Frame.Panel key={itemIndex} fit className='flex flex-col justify-between p-1! h-[60px]'>
                            <Skeleton className='h-4 w-16 rounded-full' />
                            <Skeleton className='h-3 w-20 ml-1' />
                        </Frame.Panel>
                    ))}
                </div>
            </Frame.Root>
        ))}
    </div>
)


const ActivityKanban = () => {

    const [activity, [request]] = ActivitySDK.useWith(
        (s) => s.activity,
        (q) => [q.bootstrap],
    )

    const columns = useMemo(
        () => Object.fromEntries(
            Object.entries(activity.workflows).map(([id, column]) => [id, [...column.executions].sort(byActivity)])
        ) as Record<string, Execution.Meta[]>,
        [activity.workflows],
    )

    // Most recently active first, read off each column's own top row.
    const columnIds = useMemo(
        () => Object.keys(columns).sort((a, b) =>
            Date.parse(columns[b][0]?.created_at ?? '') - Date.parse(columns[a][0]?.created_at ?? '')
        ),
        [columns],
    )

    if (request.isPending && columnIds.length === 0)
        return <ActivityKanbanSkeleton />

    return (
        <Kanban.Root
            value={columns}
            onValueChange={() => { }}
            getItemValue={(task) => task.id}
            onValueCommit={(next, meta) => console.log(meta.kind, next)}
        >
            <Kanban.Board className='flex [&>*]:w-[260px] [&>*]:shrink-0'>
                {columnIds.map((columnId) => {
                    const workflow = activity.workflows[columnId as Workflow.Id]
                    return <WorkflowColumn key={columnId} workflow={workflow} />
                })}
                <div className='w-[40px]'></div>
            </Kanban.Board>

            <Kanban.Overlay>
                {({ value }) => {
                    const workflow = activity.workflows[value as Workflow.Id]
                    return (
                        <WorkflowColumn workflow={workflow} />
                    )
                }}
            </Kanban.Overlay>
        </Kanban.Root>
    )
}

export default ActivityKanban
