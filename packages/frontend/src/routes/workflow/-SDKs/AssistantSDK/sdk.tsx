import { immer } from "zustand/middleware/immer";
import { BaseSDK } from "@pretzel-graph/standard-ui/SDKs/Base";
import { SDK } from "@pretzel-graph/standard-ui/SDKs/SDKManager";
import { DialogSDK } from "@pretzel-graph/standard-ui/SDKs/DialogSDK";
import { Chat, Execution } from "@pretzel-graph/shared/domain";
import { createWithEqualityFn } from "zustand/traditional";
import { shallow } from "zustand/shallow";
import { RealtimeSDK } from "@/SDKs/Realtime/sdk";
import { createChatSDKReducers, type ChatSDKReducers } from "../ChatSDK/reducers";
import { createAssistantSDKActions, type AssistantSDKActions } from "./actions";

@SDK("Assistant")
export class AssistantSDKImpl extends BaseSDK<AssistantSDK.State> {
    constructor() {
        super()
        this.runtime.unsubscribeFromChatChannel = RealtimeSDK.subscribeAnchored(
            this.useStore,
            s => Chat.Event.getChannel(s.currentChatId),
            this.handleChatEvent
        )
    }

    public readonly runtime = {
        unsubscribeFromChatChannel: null as (() => void) | null,
    }

    public readonly useStore: BaseSDK.Store<AssistantSDK.State> = createWithEqualityFn(
        immer<AssistantSDK.State>(() => ({
            currentChatId:    Chat.createId(),
            currentChat:      null,
            messages:         [],
            messagesRecord:   {},
            toolCallStatus:   {},
            isLoading:        false,
            isSidebarVisible: false,
            executionId:      null,
            setupStatus:      "checking",
        })),
        shallow
    )

    public readonly reducers: ChatSDKReducers = createChatSDKReducers()

    public readonly actions: AssistantSDK.Actions = createAssistantSDKActions(this)

    public override readonly query = {
        threads: () => ({
            queryKey:  ['assistant', 'threads'] as const,
            queryFn:   () => this.actions.thread.list(),
            staleTime: Infinity,
        }),
    }

    public handleChatEvent = (e: Chat.Event) => {
        switch (e.type) {
            case "message:added":
                this.setState(s => {
                    e.messages.forEach(m => this.reducers.upsertMessage(s, m))

                    if (DialogSDK.state.dialogs.has("fullscreen-assistant") === false)
                        s.isSidebarVisible = true
                })
                break
        }
    }
}

export const AssistantSDK = SDK.get<AssistantSDKImpl>("Assistant")

export namespace AssistantSDK {
    // Whether the assistant workflow is valid and can be run.
    export type SetupStatus = "checking" | "ready" | "incomplete"

    export type State = {
        currentChatId:    Chat.Id,
        currentChat:      Chat | null,
        messages:         Chat.Message.Id[],
        messagesRecord:   Record<Chat.Message.Id, Chat.Message>,
        toolCallStatus:   Record<Chat.ToolCall.Id, Chat.ToolCall.Status>,
        isLoading:        boolean,
        isSidebarVisible: boolean,
        // The run working on a reply, until it settles.
        executionId:      Execution.Id | null,
        setupStatus:      SetupStatus,
    }

    export type Actions = AssistantSDKActions
}
