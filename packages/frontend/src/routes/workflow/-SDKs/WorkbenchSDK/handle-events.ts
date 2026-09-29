import { Resource, Workbench, Workflow, type Dependency } from "@pretzel-graph/shared/domain";
import { api } from "@/SDKs/ApiInterceptorSDK";
import { toast } from "sonner";
import { LibrarySDK } from "@/SDKs/LibrarySDK/sdk";
import { RealtimeSDK } from "@/SDKs/Realtime/sdk";
import { ShelfSDK } from "../ShelfSDK/sdk";
import { animateNodeMove } from "./animations";
import type { WorkbenchSDKImpl } from "./sdk";

const { withCyclesRecompute } = Workbench.Document;

const setLocked = (workflowId: Workflow.Id, locked: boolean) => {
    const meta = LibrarySDK.state.workflowMetas[workflowId];

    if (meta)
        LibrarySDK.actions.workflow.upsertMeta({ ...meta, locked });
};

// Each edit a holder makes, mirrored on the read-only document through the same reducers.
// Events carry values, never blueprints: a new node's base is fetched from the shelf first
// and the derivative refolded here, exactly as the canvas would.
const reduceEvent = withCyclesRecompute((d: Workbench.Document, event: Workbench.Event) => {
    switch (event.type) {
        case "node:created":
            d.reducers.node.insert(d, event.node, event.position, event.staticValues as never);
            break;

        case "node:deleted":
            if (d.data.nodes[event.nodeId])
                d.reducers.node.remove(d, event.nodeId);
            break;

        case "node:moved":
            if (d.data.nodes[event.nodeId])
                d.reducers.layout.node.setPosition(d, event.nodeId, event.position);
            break;

        case "node:inputPortAdded":
            if (d.data.nodes[event.nodeId])
                d.reducers.port.addInput(d, event.nodeId, event.port);
            break;

        case "node:inputPortRemoved":
            if (d.data.nodes[event.nodeId])
                d.reducers.port.removeInput(d, event.nodeId, event.portId);
            break;

        case "node:inputPortUpdated":
            if (d.data.nodes[event.nodeId])
                d.reducers.port.updateInput(d, event.nodeId, event.portId, event.port);
            break;

        case "edge:created": {
            const edge = Workflow.Edge.fromId(event.edgeId);

            d.reducers.edge.create(d, {
                source:       edge.source.nodeId,
                sourceHandle: edge.source.portId,
                target:       edge.target.nodeId,
                targetHandle: edge.target.portId,
            });
            break;
        }

        case "edge:deleted":
            if (d.cache.edges[event.edgeId])
                d.reducers.edge.remove(d, event.edgeId);
            break;

        case "field:set": {
            const field = d.selectors.field.get(d, event.nodeId, event.fieldId);

            if (!field)
                break;

            if (field.reconcile)
                d.reducers.node.derive(d, event.nodeId, { ...d.selectors.field.getValues(d, event.nodeId), [event.fieldId]: event.value as never });

            d.reducers.field.setValue(d, event.nodeId, event.fieldId, event.value as never);
            d.reducers.node.validate(d, event.nodeId);
            break;
        }

        case "field:dependencySet": {
            const snapshot = d.selectors.dependency.get(d, event.ref);

            if (d.data.nodes[event.nodeId] && snapshot)
                d.reducers.field.dependency.setValue(d, event.nodeId, event.fieldId, event.ref, snapshot);
            break;
        }

        case "field:modeSet":
            if (d.data.nodes[event.nodeId])
                d.reducers.field.setIsExpression(d, event.nodeId, event.fieldId, event.mode === "expression");
            break;

        case "credential:instanceSet":
            if (d.data.nodes[event.nodeId])
                d.reducers.credential.setInstance(d, event.nodeId, event.templateId, event.instanceId);
            break;

        case "workflow:globalFieldsChanged":
            d.reducers.workflow.setGlobalFields(d, event.globalFields);
            break;
    }

    // Mirrored, not authored: the holder's commit is what persists this.
    d.isDirty = false;
});

// How a run's edit looks as it lands: a created node waits its turn off-canvas, a moved one
// glides. Only edits arriving on the channel reach here, so a load, refetch or undo never animates.
const animateEvent = (sdk: WorkbenchSDKImpl, event: Workbench.Event) => {
    if (event.type === "node:created")
        sdk.animations.schedule(event.node.id);

    if (event.type === "node:moved" && !sdk.state.isDraggingNode)
        animateNodeMove(event.nodeId);
};

// Events carry the ref only; the snapshot is loaded here unless the document already embeds it.
const loadSnapshot = async (sdk: WorkbenchSDKImpl, ref: Dependency.Ref): Promise<Dependency.Value | null> => {
    if (sdk.selectors.dependency.get(sdk.document, ref))
        return null;

    try {
        const { dependency } = await Resource.API.load(api, ref);

        return dependency;
    }
    catch (error) {
        console.error("Failed to load dependency for a mirrored edit", error);

        return null;
    }
};

const applyEvent = async (sdk: WorkbenchSDKImpl, event: Workbench.Event) => {
    const base = event.type === "node:created"
        ? await ShelfSDK.actions.getBlueprint(event.node.blueprintId)
        : null;

    const snapshot = event.type === "field:dependencySet"
        ? await loadSnapshot(sdk, event.ref)
        : null;

    if (event.workflowId !== sdk.document.workflowId)
        return;

    animateEvent(sdk, event);

    const temporal = (sdk.useDocument as any).temporal.getState();

    temporal.pause();
    try {
        sdk.setDocument(d => {
            if (base)
                d.reducers.blueprint.register(d, base);

            if (snapshot && event.type === "field:dependencySet")
                d.reducers.dependency.register(d, event.ref, snapshot);

            reduceEvent(d, event);
        });
    }
    finally {
        temporal.resume();
    }
};

// The open workflow's own channel: a hold taken from inside a run makes the canvas
// read-only, its edits are mirrored as they land, and its release replaces the document
// with what the run actually wrote. Mirrored edits are kept out of the undo stack and
// applied strictly in order, since one may have to wait on a blueprint fetch.
export const handleWorkbenchEvent = (sdk: WorkbenchSDKImpl, event: Workbench.Event) => {
    if (event.workflowId !== sdk.document.workflowId)
        return;

    switch (event.type) {
        case "lock:acquired":
            setLocked(event.workflowId, true);
            toast.info("A run is editing this workflow");
            return;

        case "lock:released":
            return sdk.actions.workflow.refetch(event.workflowId);

        default:
            return applyEvent(sdk, event);
    }
};

export const subscribeToWorkbenchChannel = (sdk: WorkbenchSDKImpl, workflowId: Workflow.Id) => {
    unsubscribeFromWorkbenchChannel(sdk);

    sdk.runtime.channel.unsubscribe = RealtimeSDK.subscribeToChannel<Workbench.Event>(
        Workbench.Event.getChannel(workflowId),
        event => sdk.runtime.channel.events.add(event),
    );
};

export const unsubscribeFromWorkbenchChannel = (sdk: WorkbenchSDKImpl) => {
    sdk.runtime.channel.unsubscribe?.();
    sdk.runtime.channel.unsubscribe = null;
    sdk.runtime.channel.events.clear();
    sdk.animations.clear();
};
