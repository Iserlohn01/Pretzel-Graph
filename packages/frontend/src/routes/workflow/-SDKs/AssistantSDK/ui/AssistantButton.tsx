import { Button } from '@pretzel-graph/standard-ui/foundations'
import { SystemIcons } from '@pretzel-graph/standard-ui/icons'
import { AssistantSDK } from '../sdk'
import Tipped from '@/components/Tipped'

const AssistantButton = () => {
    const isSidebarVisible = AssistantSDK.useStore(s => s.isSidebarVisible)

    return (
        <Tipped label={isSidebarVisible ? "Hide Assistant" : "Show Assistant"}>
            <Button
                variant={isSidebarVisible ? "language-model" : "ghost"}
                onClick={() => AssistantSDK.actions.ui.toggleSidebar()}
                size="icon-sm"
                className='gap-1 rounded-full text-[var(--port-LanguageModel-foreground)]!'
            >
                <SystemIcons.Sparkles className="size-4 fill-current" />
            </Button>
        </Tipped>
    )
}

export default AssistantButton
