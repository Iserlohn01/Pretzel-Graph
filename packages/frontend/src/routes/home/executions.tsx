import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { type Workflow } from '@pretzel-graph/shared/domain'
import ActivityKanban from '@/SDKs/ActivitySDK/ActivityKanban'
import { ExecutionsTable } from '@/routes/workflow/-SDKs/ExecutionSDK/ui/ExecutionsTable'
import { WorkflowIllustration } from '@pretzel-graph/standard-ui/icons/illustrations'
import { Button, ScrollArea } from '@pretzel-graph/standard-ui/foundations'
import { LibrarySDK } from '@/SDKs/LibrarySDK/sdk'


export const Route = createFileRoute('/home/executions')({
    component: ExecutionsRoute,
})


function ExecutionsRoute() {
    const [workflowId, setWorkflowId] = useState<Workflow.Id>()

    return (
        <ScrollArea.Root className='h-screen -ml-(--sidebar-width) [mask-image:linear-gradient(to_bottom,transparent,black_80px)]'>
            <div className='flex flex-col pt-[60px] h-full gap-4'>
                <div className='w-full max-h-[50vh] shrink-0 pl-[calc(var(--sidebar-width)+1rem)] pb-4 overflow-auto'>
                    <ActivityKanban />
                </div>
                <div className='pl-(--sidebar-width) pr-10'>
                    <div className='flex flex-row w-full'>
                        <Button variant={"input"} onClick={() => LibrarySDK.dialogs.openLibrarySelector({ accept: 'workflow', onSelect: (r) => setWorkflowId(r.id) })} className='w-fit'>
                            Select a Workflow
                        </Button>
                    </div>
                    {workflowId &&
                        <ExecutionsTable key={workflowId} workflowId={workflowId} />
                    }
                </div>
            
            </div>
        </ScrollArea.Root>
    )
}
