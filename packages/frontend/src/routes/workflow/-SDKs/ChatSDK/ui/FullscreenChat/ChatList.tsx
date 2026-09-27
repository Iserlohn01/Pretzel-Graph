import { ChatSDK } from '../../sdk'
import type { Workflow } from '@pretzel-graph/shared/domain'
import { useParams } from '@tanstack/react-router'
import { Conversation } from '@/components/Conversation'

const ChatList = () => {
    const { workflowid } = useParams({ from: '/workflow/$workflowid' })
    const workflowId = workflowid as Workflow.Id

    const [currentChatId, [request]] = ChatSDK.useWith((s) => s.currentChatId, (q) => [q.list(workflowId)])

    return (
        <Conversation.ThreadList
            threads={request.data ?? []}
            currentId={currentChatId}
            onSelect={(chatId) => ChatSDK.actions.chat.load(chatId)}
            onErase={(chatId) => ChatSDK.actions.chat.erase(chatId)}
            isPending={request.isPending}
            isError={request.isError}
            searchPlaceholder="Search chats..."
            emptyLabel="No chats yet."
            errorLabel="Could not load chats."
        />
    )
}

export default ChatList
