import { Template, type Library, type Listing } from '@pretzel-graph/shared/domain';
import { api } from '@/SDKs/ApiInterceptorSDK';
import type { LibrarySDKImpl } from '../sdk';
import { rebuildTree } from './tree';

export type TemplateActions = {
    list: () => Promise<Template.API.List.Response>;
    remix: (listingId: Listing.Id, folderId: Library.Folder.Id) => Promise<Template.API.Remix.Response>;
};

export function createTemplateActions(sdk: LibrarySDKImpl) {
    const setState = sdk.useStore.setState;

    return {
        list: async () => {
            const data = await Template.API.list(api);
            setState((s) => {
                s.templates = data.templates as typeof s.templates;
            });
            return data;
        },

        remix: async (listingId, folderId) => {
            const data = await Template.API.remix(api, listingId, { folder_id: folderId });
            const { data: _data, ...meta } = data;
            setState((s) => { s.workflowMetas[data.id] = meta as Library.WorkflowMeta; });
            rebuildTree(sdk);
            return data;
        },
    } satisfies TemplateActions
}
