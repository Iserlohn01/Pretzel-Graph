import { useState } from 'react'
import { DropdownMenu, Input, Skeleton } from '@pretzel-graph/standard-ui/foundations'
import { AssistantSDK } from '../../sdk'

const THREAD_SKELETONS = ['w-32', 'w-24', 'w-36', 'w-28']

const SelectThread = () => {
    const [query, setQuery] = useState('')

    const [, [request]] = AssistantSDK.useWith(() => null, (q) => [q.threads()])

    const needle  = query.trim().toLowerCase()
    const threads = (request.data ?? []).filter(thread => !needle || thread.name?.toLowerCase().includes(needle))

    return (
        <div className='flex flex-col gap-2'>
            <Input
                value={query}
                onChange={e => setQuery(e.target.value)}
                className='w-full rounded-lg pr-8'
                placeholder='Search in conversations'
                size="sm"
                onKeyDown={e => e.stopPropagation()}
            />

            <div className='max-h-72 overflow-y-auto'>
                {request.isPending ? (
                    THREAD_SKELETONS.map((width, index) => (
                        <div className='px-2 py-2.5' key={index}>
                            <Skeleton className={`h-3.5 ${width}`} />
                        </div>
                    ))
                ) : request.isError ? (
                    <div className='px-2 py-3 text-xs text-destructive'>Could not load conversations.</div>
                ) : threads.length > 0 ? (
                    threads.map(thread => (
                        <DropdownMenu.Item key={thread.id} className='items-start! rounded-md px-2 py-2' onSelect={() => AssistantSDK.actions.thread.load(thread.id)}>
                            <div className='flex flex-col gap-0.5'>
                                <span className='text-sm font-medium text-foreground'>{thread.name}</span>
                            </div>
                        </DropdownMenu.Item>
                    ))
                ) : (
                    <div className='px-2 py-3 text-xs text-muted-foreground'>No conversations found.</div>
                )}
            </div>
        </div>
    )
}

export default SelectThread
