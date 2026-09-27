import { openCreateFolderDialog, openEditFolderDialog, openDeleteFolderDialog } from './folder-dialogs'
import { openCreateWorkflowDialog, openEditWorkflowDialog, openDeleteWorkflowDialog } from "./workflow-dialogs"
import { openDependencySelectorDialog } from './DependencySelector'
import { openLibrarySelector } from './LibrarySelector'
import { openCreateSkillDialog, openSkillEditorDialog, openDeleteSkillDialog } from './skill-dialogs'
import { openCreateConnectionDialog, openEditConnectionDialog, openDeleteConnectionDialog } from './connection-dialogs'

export function _createLibraryDialogs_() {
    return {
        openCreateSkill:          openCreateSkillDialog,
        openSkillEditor:          openSkillEditorDialog,
        openDeleteSkill:          openDeleteSkillDialog,
        openCreateConnection:     openCreateConnectionDialog,
        openEditConnection:       openEditConnectionDialog,
        openDeleteConnection:     openDeleteConnectionDialog,
        openCreateFolder:         openCreateFolderDialog,
        openEditFolder:           openEditFolderDialog,
        openDeleteFolder:         openDeleteFolderDialog,
        openCreateWorkflow:       openCreateWorkflowDialog,
        openEditWorkflow:         openEditWorkflowDialog,
        openDeleteWorkflow:       openDeleteWorkflowDialog,
        openDependencySelector:   openDependencySelectorDialog,
        openLibrarySelector:     openLibrarySelector,
    }
}

export type _LibrarySDKDialogs = ReturnType<typeof _createLibraryDialogs_>
