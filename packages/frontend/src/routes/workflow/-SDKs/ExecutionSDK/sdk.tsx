import { immer } from "zustand/middleware/immer";
import { BaseSDK } from "@pretzel-graph/standard-ui/SDKs/Base";
import { SDK } from "@pretzel-graph/standard-ui/SDKs/SDKManager";
import { Execution, Workflow } from "@pretzel-graph/shared/domain";
import { createWithEqualityFn } from "zustand/traditional";
import { shallow } from "zustand/shallow";
import { createExecutionSDKActions, type ExecutionSDKActions } from "./actions";
import { _createExecutionReducers_, initialTimelineState, type _ExecutionSessionReducers } from "./reducers";
import { executionSDKSelectors, type ExecutionSDKSelectors, type TimelineLayout } from "./selectors";
import type { TimeScale, TimelineViewMode } from "./ui/Timeline/time-scale";
import { RealtimeSDK } from "@/SDKs/Realtime/sdk";
import { api } from "@/SDKs/ApiInterceptorSDK";
import { discardQueuedEvents, handleExecutionEvents } from "./handle-events";
import { observeCurrentExecution, type CurrentExecutionObserver, type ObserveOptions as ObserveOptions_ } from "./observe";
import type { ChatSDKImpl } from "../ChatSDK/sdk";

const LIST_STALE_TIME = 30_000

@SDK("Execution")
export class ExecutionSDKImpl extends BaseSDK<ExecutionSDK.State> {

    constructor() { 
        super() 
        
        this.observeCurrent({
            onDetach: () => this.unsubscribeFromExecutionChannel(),
            onAttach: (execution) => this._subscribeToExecutionChannel(execution.id),
        }, { immediate: true })
    }

    public readonly useStore: BaseSDK.Store<ExecutionSDK.State> = createWithEqualityFn(
        immer<ExecutionSDK.State>(() => ({
            currentExecution: undefined,
            awaitedConfirmation: new Set(),
            selectors: executionSDKSelectors,
            reducers: _createExecutionReducers_(),
            igniterAttributes: {
                record: false,
                debug: false
            },
            timeline: initialTimelineState(),
            isTimelineGeometryDirty: false,
        })),
        shallow
    )

    public readonly actions: ExecutionSDK.Actions = createExecutionSDKActions(this);

    public override readonly query = {
        list: (workflowId: Workflow.Id) => ({
            queryKey:  ['execution', 'list', workflowId] as const,
            queryFn:   () => this.actions.list(workflowId),
            staleTime: LIST_STALE_TIME,
        }),
    }
    
    public expectConfirmation = (event: ExecutionSDK.AwaitedConfirmation): () => void => {
        this.actions.addAwaitedConfirmation(event);
        return () => { this.actions.removeAwaitedConfirmation(event); };
    }
    
    public readonly runtime = {
        unsubscribeChannel:     null as (() => void) | null,
        subscribedExecutionId:  null as Execution.Id | null,
        // Inbound event batching. Scoped to the SDK rather than the module so a
        // pending flush can be dropped when we detach — see handle-events.
        events: {
            queue:     [] as Execution.Event.Base[],
            timer:     null as ReturnType<typeof setTimeout> | null,
            lastFlush: 0,
            listeners: new Set<ExecutionSDK.Listener>(),
        },
        timeline: {
            scrollRef: { current: null as HTMLDivElement | null },
            rulerRef:  { current: null as HTMLDivElement | null },
            labelsRef: { current: null as HTMLDivElement | null },
        },
    }

    // Scroll sync: the main canvas drives the ruler (x) and labels (y).
    public syncTimelineScroll = () => {
        const { scrollRef, rulerRef, labelsRef } = this.runtime.timeline;
        const sc = scrollRef.current;
        if (!sc) return;
        if (rulerRef.current)  rulerRef.current.scrollLeft  = sc.scrollLeft;
        if (labelsRef.current) labelsRef.current.scrollTop  = sc.scrollTop;
    }
    public syncTimelineLabelScroll = () => {
        const { scrollRef, labelsRef } = this.runtime.timeline;
        const lb = labelsRef.current;
        if (!lb) return;
        if (scrollRef.current) scrollRef.current.scrollTop = lb.scrollTop;
    }

    // Channel plumbing, not a subscriber API — consumers wanting execution events
    // register a listener instead. Bound to whichever execution is in view.
    public _subscribeToExecutionChannel(executionId: Execution.Id) {
        if (this.runtime.subscribedExecutionId === executionId) return;

        this.unsubscribeFromExecutionChannel();
        this.runtime.subscribedExecutionId = executionId;

        console.log("Subscribing to execution events for executionId:", executionId)

        this.runtime.unsubscribeChannel = RealtimeSDK.subscribeToChannel(
            Execution.Event.getChannel(executionId),
            (e: Execution.Event.Base) => handleExecutionEvents(this, e)
        )
    }

    private unsubscribeFromExecutionChannel() {
        this.runtime.unsubscribeChannel?.();
        this.runtime.unsubscribeChannel = null;
        this.runtime.subscribedExecutionId = null;

        discardQueuedEvents(this);
    }

    public subscribeToEvents(listener: ExecutionSDK.Listener): () => void {
        const { listeners } = this.runtime.events;

        listeners.add(listener);

        return () => { listeners.delete(listener) };
    }

    public observeCurrent(observer: ExecutionSDK.Observer, opts?: ExecutionSDK.ObserveOptions) {
        return observeCurrentExecution(this, observer, opts);
    }


    public get chatSDK(): ChatSDKImpl { return SDK.get<ChatSDKImpl>("Chat") }
}

export const ExecutionSDK = SDK.get<ExecutionSDKImpl>("Execution")




// Heartbeat: while paused, send a heartbeat every 2 minutes on mouse activity
// to prevent the worker from terminating the paused job.
const HEARTBEAT_INTERVAL_MS = 2 * 60_000;
let heartbeatListener: (() => void) | null = null;

function startHeartbeat(executionId: Execution.Id) {
    stopHeartbeat();

    let lastSent = 0;

    heartbeatListener = () => {
        const now = Date.now();
        if (now - lastSent < HEARTBEAT_INTERVAL_MS) return;
        lastSent = now;
        Execution.API.heartbeat(api, executionId).catch(() => {});
    };

    document.addEventListener("mousemove", heartbeatListener);
}

function stopHeartbeat() {
    if (heartbeatListener) {
        document.removeEventListener("mousemove", heartbeatListener);
        heartbeatListener = null;
    }
}

ExecutionSDK.observeCurrent({
    onSettle: (execution) => void ExecutionSDK.invalidate(ExecutionSDK.query.list(execution.workflow_id)),
})

ExecutionSDK.observeCurrent({
    onPause:  (execution) => startHeartbeat(execution.id),
    onDetach: () => stopHeartbeat(),

    onStatusChange: (_, from) => {
        if (from === "paused")
            stopHeartbeat();
    },

    onAttach: (execution) => {
        if (execution.status === "paused")
            startHeartbeat(execution.id);
    },
}, { immediate: true })






export namespace ExecutionSDK {
    export type AwaitedConfirmation = "started" | "paused" | "resumed" | "terminated" | "suspended" | "executed"

    /** Receives one flush's worth of claimed events, in arrival order. See subscribeToEvents. */
    export type Listener = (batch: Execution.Event.Base[]) => void

    export type State = {
        currentExecution?: Execution
        awaitedConfirmation: Set<AwaitedConfirmation>
        selectors: ExecutionSDKSelectors
        reducers: ExecutionSDK.Reducers
        igniterAttributes: {
            record: boolean,
            debug: boolean,
        },
        timeline: {
            zoom:          number
            viewMode:      TimelineViewMode
            showRemnants:  boolean
            selectedUoW:   Execution.Recording.UnitOfWork.Id | null
            layout:        TimelineLayout
            scale:         TimeScale
            totalDuration: number
            totalWidth:    number
        }
        // Set by anything that changes unit durations; cleared by timeline.recompute.
        // Lets a streaming flush skip the O(units) rescale when the batch was all
        // lifecycle/session traffic — recompute always builds a fresh `scale` object,
        // which would re-render every UoWBlock.
        isTimelineGeometryDirty: boolean
    }

    export type Reducers = _ExecutionSessionReducers
    export type Actions = ExecutionSDKActions;
    export type Selectors = ExecutionSDKSelectors
    export type Observer = CurrentExecutionObserver
    export type ObserveOptions = ObserveOptions_
}
