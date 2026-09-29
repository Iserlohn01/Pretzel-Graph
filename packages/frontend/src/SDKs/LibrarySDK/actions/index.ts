import { Library } from '@pretzel-graph/shared/domain';
import { api } from '@/SDKs/ApiInterceptorSDK';
import { writeShowHidden, type LibrarySDKImpl } from '../sdk';
import { rebuildTree } from './tree';
import { createFolderActions, type FolderActions } from './folder';
import { createWorkflowActions, type WorkflowActions } from './workflow';
import { createSkillActions, type SkillActions } from './skill';
import { createTemplateActions, type TemplateActions } from './template';

export type { FileSystemNodeData } from './tree';

export type _LibrarySDKActions = {
    rebuildTree: () => void;
    preferences: {
        setFolderExpanded: (folderId: Library.Folder.Id, isExpanded: boolean) => void;
        setShowHidden: (showHidden: boolean) => void;
    };
    bootstrap: {
        get: () => Promise<Library.API.Bootstrap.Get.Response>;
    };
    folder: FolderActions;
    workflow: WorkflowActions;
    skill: SkillActions;
    template: TemplateActions;
};

export function _createLibraryActions_(sdk: LibrarySDKImpl) {
    const setState = sdk.useStore.setState;

    return {
        rebuildTree: () => rebuildTree(sdk),

        preferences: {
            setFolderExpanded: (folderId, isExpanded) => {
                setState((s) => {
                    s.treeExpandedByFolderId[folderId] = isExpanded;
                });
                rebuildTree(sdk);
            },

            setShowHidden: (showHidden) => {
                setState((s) => {
                    s.showHidden = showHidden;
                });
                writeShowHidden(showHidden);
                rebuildTree(sdk);
            },
        },

        bootstrap: {
            get: async () => {
                const data = await Library.API.Bootstrap.get(api);
                setState((s) => {
                    s.folders = Object.fromEntries(data.folders.map((f) => [f.id, f])) as typeof s.folders;
                    s.workflowMetas = Object.fromEntries(data.workflow_metas.map((w) => [w.id, w])) as typeof s.workflowMetas;
                    s.skillMetas = Object.fromEntries(data.skill_metas.map((k) => [k.id, k])) as typeof s.skillMetas;
                });
                rebuildTree(sdk);
                return data;
            },
        },

        folder:   createFolderActions(sdk),
        workflow: createWorkflowActions(sdk),
        skill:    createSkillActions(sdk),
        template: createTemplateActions(sdk),
    } satisfies _LibrarySDKActions
}
