import { immer } from "zustand/middleware/immer";
import { BaseSDK } from "@pretzel-graph/standard-ui/SDKs/Base";
import { SDK } from "@pretzel-graph/standard-ui/SDKs/SDKManager";
import { Chat, Workflow } from "@pretzel-graph/shared/domain";
import { createChatSDKActions, type ChatSDKActions } from "./actions";
import { createChatSDKReducers, type ChatSDKReducers } from "./reducers";
import { RealtimeSDK } from "@/SDKs/Realtime/sdk";
import { DialogSDK } from "@pretzel-graph/standard-ui/SDKs/DialogSDK";
import type { ExecutionSDKImpl } from "../ExecutionSDK/sdk";
import { createWithEqualityFn } from "zustand/traditional";
import { shallow } from "zustand/shallow";

@SDK("Chat")
export class ChatSDKImpl extends BaseSDK<ChatSDK.State> {
    constructor() {
        super()
        this.runtime.unsubscribeFromChatChannel = RealtimeSDK.subscribeAnchored(
            this.useStore,
            s => s.currentChatId ? Chat.Event.getChannel(s.currentChatId) : null,
            this.handleOnEvent
        )
    }


    public readonly runtime = {
        unsubscribeFromChatChannel: null as (() => void) | null
    }


    public readonly useStore: BaseSDK.Store<ChatSDK.State> = createWithEqualityFn(
        immer<ChatSDK.State>(() => ({
            currentChatId: Chat.createId(),
            messages: [],
            messagesRecord: {},
            toolCallStatus: {},
            isLoading: false,
            isSidebarVisible: false,
            currentChat: null,
            reducers: createChatSDKReducers(),
        })),
        shallow
    )


    public readonly actions = createChatSDKActions(this);


    public override readonly query = {
        list: (workflowId: Workflow.Id) => ({
            queryKey:  ['chat', 'list', workflowId] as const,
            queryFn:   () => this.actions.chat.listByWorkflow(workflowId),
            staleTime: Infinity,
        }),
    }


    public get executionSDK(): ExecutionSDKImpl { return SDK.get<ExecutionSDKImpl>("Execution") }

    public handleOnEvent = (e: Chat.Event) => {
        switch (e.type) {
            case "message:added":
                this.useStore.setState(s => {
                    e.messages.forEach(m => {
                        s.reducers.upsertMessage(s, m);

                        if (DialogSDK.state.dialogs.has("fullscreen-chat") === false)
                            s.isSidebarVisible = true;
                    })
                })
                break;
        }
    }
}

export const ChatSDK = SDK.get<ChatSDKImpl>("Chat")



export namespace ChatSDK {
    export type State = {
        currentChatId: Chat.Id,
        messages: Chat.Message.Id[],
        messagesRecord: Record<Chat.Message.Id, Chat.Message>,
        toolCallStatus: Record<Chat.ToolCall.Id, Chat.ToolCall.Status>,
        isLoading: boolean,
        isSidebarVisible: boolean,
        currentChat: Chat | null,
        reducers: ChatSDK.Reducers,
    }

    export type Reducers = ChatSDKReducers

    export type Actions = ChatSDKActions
}
