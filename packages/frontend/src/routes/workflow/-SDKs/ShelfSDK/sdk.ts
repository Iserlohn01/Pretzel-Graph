import { BaseSDK } from "@pretzel-graph/standard-ui/SDKs/Base";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { Foundations, Shelf } from "@pretzel-graph/shared/domain";
import { _createShelfActions_, type _ShelfActions } from "./actions";
import { _createShelfReducers_, type _ShelfReducers } from "./reducers";
import { enableMapSet } from "immer";
import { SDK } from "@pretzel-graph/standard-ui/SDKs/SDKManager";
enableMapSet();

const SECTION_RETRIES = 5
const SECTION_RETRY_DELAY = 1000

@SDK("Shelf")
export class ShelfSDKImpl extends BaseSDK<ShelfSDK.State> {

    constructor() { super() }

    public readonly useStore: BaseSDK.Store<ShelfSDK.State> = create(
        immer<ShelfSDK.State>(() => ({
            sections: {
                core_extended: Shelf.Drawer.SECTIONS.core_extended,
                integrations: Shelf.Drawer.SECTIONS.integrations,
            },
            selectedSection: "core_extended",
            drawers: Shelf.Drawer.ALL_DRAWERS,
            blueprints: {},
            filteredDrawers: {},
            loadedSections: new Set<Shelf.Section>(),
            openedDrawers: new Set<Shelf.Drawer.Id>(),
            searchFilter: {
                query: null,
                selectionFilters: new Set<Shelf.Section>(["core_extended"]),
            },
            reducers: _createShelfReducers_(),
        }))
    )

    public readonly actions: ShelfSDK.Actions = _createShelfActions_(this);

    public override readonly query = {
        section: (section: Shelf.Section) => ({
            queryKey:   ['shelf', 'section', section] as const,
            queryFn:    () => this.actions.loadSection(section),
            staleTime:  Infinity,
            retry:      SECTION_RETRIES,
            retryDelay: () => SECTION_RETRY_DELAY,
        }),
    }
}



export const ShelfSDK = SDK.get<ShelfSDKImpl>("Shelf")


export namespace ShelfSDK {
    export type State = {
        sections: Record<Shelf.Section, Shelf.Drawer.Id[]>
        drawers: Record<Shelf.Drawer.Id, Shelf.Drawer>
        blueprints: Record<Foundations.Blueprint.Id, Foundations.Blueprint>
        filteredDrawers: Record<Shelf.Drawer.Id, Shelf.Drawer>
        selectedSection: Shelf.Section
        openedDrawers: Set<Shelf.Drawer.Id>
        loadedSections: Set<Shelf.Section>
        searchFilter: {
            query: string | null,
            selectionFilters: Set<Shelf.Section>
        },
        reducers: ShelfSDK.Reducers
    }

    export type Actions = _ShelfActions
    export type Reducers = _ShelfReducers
}    
