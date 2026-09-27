import { Library, type Workflow } from '@pretzel-graph/shared/domain';
import { api } from '@/SDKs/ApiInterceptorSDK';
import type { LibrarySDK, LibrarySDKImpl } from '../sdk';
import { rebuildTree } from './tree';

export type WorkflowActions = {
    upsertMeta: (meta: Library.WorkflowMeta) => void;
    create: (payload: Library.API.Workflow.Create.Request) => Promise<Library.API.Workflow.Create.Response>;
    update: (payload: Library.API.Workflow.Update.Request) => Promise<Library.API.Workflow.Update.Response>;
    setLock: (id: Workflow.Id, locked: boolean) => Promise<Library.API.Workflow.Update.Response>;
    setHidden: (id: Workflow.Id, hidden: boolean) => Promise<Library.API.Workflow.Update.Response>;
    move: (id: Workflow.Id, folderId: Library.Folder.Id) => Promise<Library.API.Workflow.Update.Response>;
    delete: (id: Workflow.Id) => Promise<Library.API.Workflow.Remove.Response>;
    duplicate: (id: Workflow.Id) => Promise<Library.API.Workflow.Duplicate.Response>;
};

export function putMeta(s: LibrarySDK.State, meta: Library.WorkflowMeta) {
    s.workflowMetas[meta.id] = meta;
}

export function createWorkflowActions(sdk: LibrarySDKImpl) {
    const setState = sdk.useStore.setState;

    return {
        // Used by non-Library creation flows (e.g. Workbench createSubWorkflow)
        // to keep the Library tree in sync without triggering a full bootstrap.
        upsertMeta: (meta) => {
            setState((s) => { s.workflowMetas[meta.id] = meta; });
            rebuildTree(sdk);
        },

        create: async (payload) => {
            const data = await Library.API.Workflow.create(api, payload);
            // Full Workflow returned; cache the meta projection (omit data).
            const { data: _data, ...meta } = data;
            setState((s) => { s.workflowMetas[data.id] = meta as Library.WorkflowMeta; });
            rebuildTree(sdk);
            return data;
        },

        update: async (payload) => {
            const data = await Library.API.Workflow.update(api, payload);
            setState((s) => { putMeta(s, data); });
            rebuildTree(sdk);
            return data;
        },

        setLock: async (id, locked) => {
            const data = await Library.API.Workflow.update(api, { id, locked });
            setState((s) => { putMeta(s, data); });
            return data;
        },

        setHidden: async (id, hidden) => {
            const data = await Library.API.Workflow.update(api, { id, hidden });
            setState((s) => { putMeta(s, data); });
            rebuildTree(sdk);
            return data;
        },

        move: async (id, folderId) => {
            const data = await Library.API.Workflow.update(api, { id, folder_id: folderId });
            setState((s) => { putMeta(s, data); });
            rebuildTree(sdk);
            return data;
        },

        delete: async (id) => {
            const data = await Library.API.Workflow.remove(api, { id });
            setState((s) => { delete s.workflowMetas[id]; });
            rebuildTree(sdk);
            return data;
        },

        duplicate: async (id) => {
            const data = await Library.API.Workflow.duplicate(api, { id });
            const { data: _data, ...meta } = data;
            setState((s) => { s.workflowMetas[data.id] = meta as Library.WorkflowMeta; });
            rebuildTree(sdk);
            return data;
        },
    } satisfies WorkflowActions
}
