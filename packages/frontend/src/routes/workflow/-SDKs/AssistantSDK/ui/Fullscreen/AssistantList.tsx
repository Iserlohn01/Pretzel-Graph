import { AssistantSDK } from '../../sdk'
import { Conversation } from '@/components/Conversation'

const AssistantList = () => {
    const [currentChatId, [request]] = AssistantSDK.useWith((s) => s.currentChatId, (q) => [q.threads()])

    return (
        <Conversation.ThreadList
            threads={request.data ?? []}
            currentId={currentChatId}
            onSelect={(chatId) => AssistantSDK.actions.thread.load(chatId)}
            onErase={(chatId) => AssistantSDK.actions.thread.erase(chatId)}
            isPending={request.isPending}
            isError={request.isError}
        />
    )
}

export default AssistantList
