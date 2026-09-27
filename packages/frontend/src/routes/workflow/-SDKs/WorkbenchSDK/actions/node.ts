import type { DropFirstArg } from "@/SDKs/types";
import type { WorkbenchSDKImpl, WorkbenchSDK } from "../sdk"
import { withAsyncCommit, withCommit, withCyclesRecompute } from "../utils/actions"
import { ShelfSDK } from "../../ShelfSDK/sdk";
import { Resource, SystemError, type Workflow } from "@pretzel-graph/shared/domain";
import type { Field } from "@pretzel-graph/shared/domain/Foundations/Field";
import { toast } from "sonner";
import { ANIMATE_EVERY_CREATE } from "../animations";
import { api } from "@/SDKs/ApiInterceptorSDK";

export function createNodeActions(sdk: WorkbenchSDKImpl) {
    const setDocument = sdk.setDocument;
    const reducers = sdk.reducers;

    return {
        remove:            withCommit((...props) => {setDocument(withCyclesRecompute(d => { reducers.node.remove(d, ...props) })) }),
        duplicate:         withCommit((...props) => setDocument(d => { reducers.node.duplicate(d,         ...props) })),
        setDisabled:       withCommit((...props) => setDocument(d => { reducers.node.setDisabled(d,       ...props) })),
        setMinimized:      withCommit((...props) => setDocument(d => { reducers.node.setMinimized(d,      ...props) })),
        setFlipped:        withCommit((...props) => setDocument(d => { reducers.node.setFlipped(d,        ...props) })),
        setDisplayName:    withCommit((...props) => setDocument(d => { reducers.node.setDisplayName(d,    ...props) })),
        setDescription:    withCommit((...props) => setDocument(d => { reducers.node.setDescription(d,    ...props) })),
        setSignalStrategy: withCommit((...props) => setDocument(d => { reducers.node.setSignalStrategy(d, ...props) })),
        
        validate:          (...props) => { setDocument(d => { reducers.node.validate(d,       ...props) }) },
        clearIssues:       (...props) => { setDocument(d => { reducers.node.clearIssues(d,    ...props) }) },

        recreate:          withAsyncCommit( async (nodeId, ) => {
            const s = sdk.document;
            const node = s.data.nodes[nodeId];
            
            await ShelfSDK.actions.hydrateBlueprint(node.blueprintId)
            
            const blueprintId = node.blueprintId;
            
            const blueprint = ShelfSDK.state.blueprints[node.blueprintId];
            
            if(blueprintId === "Core.SubWorkflow.Execute") {
                toast.error("Cannot manually set a subworkflow dependency. Please use the dependency selector field to select and load a workflow as a dependency.")
                return;
            }
            
            
            setDocument(withCyclesRecompute(d => { reducers.node.recreate(d, nodeId, blueprint)}));
        }),
        recreateAll:       withAsyncCommit( async () => {
            const s = sdk.document;
            const nodes = Object.values(s.data.nodes);

            // Nodes with a dependency (e.g. an attached subworkflow) derive their shape from
            // that dependency, not a static blueprint, so they can't be blindly recreated — skip them.
            const recreatable = nodes.filter(n => !sdk.selectors.node.dependency.getShapeRef(s, n.id));

            // Hydrate each distinct blueprint once (parallel), so we recreate from fresh blueprints.
            const blueprintIds = [...new Set(recreatable.map(n => n.blueprintId))];
            await Promise.all(blueprintIds.map(id => ShelfSDK.actions.hydrateBlueprint(id)));

            const blueprints = ShelfSDK.state.blueprints;

            // Run every recreate in a single commit + cycles recompute → one undo step.
            setDocument(withCyclesRecompute(d => {
                for (const node of recreatable) {
                    const blueprint = blueprints[node.blueprintId];
                    if (!blueprint) {
                        console.error(`Skipping recreate for ${node.id}: blueprint ${node.blueprintId} failed to hydrate`);
                        continue;
                    }
                    reducers.node.recreate(d, node.id, blueprint);
                }
            }));
        }),
        create:        withAsyncCommit( async (...props) => { 
            let createdId = null as Workflow.Node.Id | null;

            setDocument(d => {
                createdId = reducers.node.create(d, ...props)
            })

            const nodeId = createdId;
            if (!nodeId)
                return;

            if (ANIMATE_EVERY_CREATE)
                sdk.animations.schedule(nodeId);

            // A pre-wired node lands with its dependency pointer set; fetch the snapshot if the workflow
            // lacks it. On failure, remove the node — it can't function without its dependency data.
            const shapeDepRef = sdk.selectors.node.dependency.getShapeRef(sdk.document, nodeId);

            if (!shapeDepRef || sdk.selectors.dependency.get(sdk.document, shapeDepRef))
                return;

            try {
                const { dependency } = await Resource.API.load(api, shapeDepRef);

                setDocument(d => {
                    reducers.dependency.register(d, shapeDepRef, dependency)
                })
            }
            catch (err) {
                const error = SystemError.fromUnknown(err)

                toast.error(`Failed to load dependency for node: ${error.message}`)
                sdk.actions.node.remove(nodeId)
            }
        }),
    } satisfies NodeActions;
}

export type NodeActions = {
    remove              : DropFirstArg<WorkbenchSDK.Reducers['node']['remove']>;
    create              : DropFirstArg<WorkbenchSDK.Reducers['node']['create']>;
    duplicate           : DropFirstArg<WorkbenchSDK.Reducers['node']['duplicate']>;
    setSignalStrategy   : DropFirstArg<WorkbenchSDK.Reducers['node']['setSignalStrategy']>;
    setDisabled         : DropFirstArg<WorkbenchSDK.Reducers['node']['setDisabled']>;
    setMinimized        : DropFirstArg<WorkbenchSDK.Reducers['node']['setMinimized']>;
    setFlipped          : DropFirstArg<WorkbenchSDK.Reducers['node']['setFlipped']>;
    setDisplayName      : DropFirstArg<WorkbenchSDK.Reducers['node']['setDisplayName']>;
    setDescription      : DropFirstArg<WorkbenchSDK.Reducers['node']['setDescription']>;
    validate            : DropFirstArg<WorkbenchSDK.Reducers['node']['validate']>;
    clearIssues         : DropFirstArg<WorkbenchSDK.Reducers['node']['clearIssues']>;
    recreate            : (nodeId: Workflow.Node.Id) => void;
    recreateAll         : () => void;
};
