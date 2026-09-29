import { Kanban } from '@pretzel-graph/standard-ui/components/kanban'
import { Frame } from '@pretzel-graph/standard-ui/foundations'
import { SystemIcons } from '@pretzel-graph/standard-ui/icons'
import { IconRenderer } from '@pretzel-graph/standard-ui/icons/IconRenderer'
import type { Activity } from '@pretzel-graph/shared/domain'
import ExecutionItem from './ExecutionItem'
import { iconColor } from './styles'


const WorkflowColumn = ({ workflow }: { workflow: Activity.Workflow }) => {

    return (
        <Kanban.Column key={workflow.id} value={workflow.id} asChild>
            <Frame.Root spacing='sm' className='p-2 gap-2 bg-card/80'>
                <Frame.Header className='flex flex-row px-2 pt-0! items-center gap-2'>
                    <IconRenderer
                        name={workflow.icon ?? "Graph"}
                        className="size-4"
                        style={{ color: iconColor(workflow) }}
                    />
                    <Frame.Title className='text-xs'>
                        {workflow.display_name}
                    </Frame.Title>

                    <Kanban.ColumnHandle className='ml-auto'>
                        <SystemIcons.GripVertical size={14} />
                    </Kanban.ColumnHandle>
                </Frame.Header>
                <Kanban.ColumnContent value={workflow.id} className='gap-2'>
                    {workflow.executions.map((execution) => (
                        <ExecutionItem key={execution.id} execution={execution} />
                    ))}
                </Kanban.ColumnContent>
            </Frame.Root>
        </Kanban.Column>
    )
}

export default WorkflowColumn
