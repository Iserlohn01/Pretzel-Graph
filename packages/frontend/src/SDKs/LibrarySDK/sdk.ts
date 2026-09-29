import { immer } from "zustand/middleware/immer";
import { _createLibraryActions_, type _LibrarySDKActions } from "./actions";
import { _createLibrarySelectors_, type _LibrarySDKSelectors } from "./selectors";
import { BaseSDK } from "@pretzel-graph/standard-ui/SDKs/Base";
import { Workflow, Library, Skill, type Gateway, type Listing, type Template } from "@pretzel-graph/shared/domain";
import { SDK } from "@pretzel-graph/standard-ui/SDKs/SDKManager";
import { createWithEqualityFn } from "zustand/traditional";
import { shallow } from "zustand/shallow";
import type { Tree as TreeDomain } from '@/components/Tree/domain';
import type { FileSystemNodeData } from './actions';
import { _createLibraryDialogs_, type _LibrarySDKDialogs } from './dialogs';
import { GatewaySDK } from '@/SDKs/GatewaySDK/sdk';
import { rebuildTree } from './actions/tree';

const BOOTSTRAP_STALE_TIME = 60_000

const TEMPLATES_STALE_TIME = 5 * 60_000

@SDK("Library")
export class LibrarySDKImpl extends BaseSDK<LibrarySDK.State> {

    constructor() {
        super()

        // Connections live in GatewaySDK and appear in the tree, so it rebuilds whenever they change.
        GatewaySDK.subscribe((state, previous) => {
            if (state.connections !== previous.connections)
                rebuildTree(this)
        })
    }

    public readonly useStore = createWithEqualityFn<LibrarySDK.State>()(
        immer(() => ({
            folders: {},
            workflowMetas: {},
            skillMetas: {},
            templates: {},
            treeExpandedByFolderId: {},
            treeData: {},
            showHidden: readShowHidden(),
            selectors: _createLibrarySelectors_(this)
        })),
        shallow
    )

    private _config = {}
    public get config() { return this._config }

    public readonly selectors: LibrarySDK.Selectors = _createLibrarySelectors_(this)
    public readonly actions: LibrarySDK.Actions = _createLibraryActions_(this)

    public override readonly query = {
        bootstrap: {
            queryKey: ['library', 'bootstrap'] as const,
            queryFn: () => this.actions.bootstrap.get(),
            staleTime: BOOTSTRAP_STALE_TIME,
        },
        templates: {
            queryKey: ['library', 'templates'] as const,
            queryFn: () => this.actions.template.list(),
            staleTime: TEMPLATES_STALE_TIME,
        },
    }

    public readonly dialogs: LibrarySDK.Dialogs = _createLibraryDialogs_()
}


const SHOW_HIDDEN_KEY = 'library.showHidden'

function readShowHidden(): boolean {
    try {
        return localStorage.getItem(SHOW_HIDDEN_KEY) === 'true'
    } catch {
        return false
    }
}

export function writeShowHidden(value: boolean) {
    try {
        localStorage.setItem(SHOW_HIDDEN_KEY, String(value))
    } catch {
        // storage unavailable; the toggle still works for this session
    }
}

export const LibrarySDK = SDK.get<LibrarySDKImpl>("Library")

export namespace LibrarySDK {

    export type State = {
        folders: Record<Library.Folder.Id, Library.Folder>;
        selectors: _LibrarySDKSelectors
        workflowMetas: Record<Workflow.Id, Library.WorkflowMeta>;
        skillMetas: Record<Skill.Id, Skill.Meta>;
        templates: Record<Listing.Id, Template>;
        treeExpandedByFolderId: Record<Library.Folder.Id, boolean>;
        treeData: TreeDomain.Dummy.Branch<FileSystemNodeData>;
        showHidden: boolean;
    }

    // A library entry the browser opens or picks on click.
    export type Item =
        | { type: 'workflow';   id: Workflow.Id }
        | { type: 'skill';      id: Skill.Id }
        | { type: 'connection'; id: Gateway.Connection.Id }

    export type Selectors = _LibrarySDKSelectors
    export type Actions = _LibrarySDKActions
    export type Dialogs = _LibrarySDKDialogs
}
