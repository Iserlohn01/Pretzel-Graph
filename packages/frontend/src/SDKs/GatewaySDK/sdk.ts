import { immer } from "zustand/middleware/immer";
import { createWithEqualityFn } from "zustand/traditional";
import { shallow } from "zustand/shallow";
import { BaseSDK } from "@pretzel-graph/standard-ui/SDKs/Base";
import { SDK } from "@pretzel-graph/standard-ui/SDKs/SDKManager";
import { Gateway } from "@pretzel-graph/shared/domain";
import { RealtimeSDK } from "@/SDKs/Realtime/sdk";
import { _createGatewayActions_, type _GatewaySDKActions } from "./actions";
import { _gatewaySelectors_, type _GatewaySDKSelectors } from "./selectors";

const CONNECTIONS_STALE_TIME = 30_000
const DEFINITIONS_STALE_TIME = Infinity

@SDK("Gateway")
export class GatewaySDKImpl extends BaseSDK<GatewaySDK.State> {

    constructor() {
        super()

        // One channel for the workspace, held for the session.
        this.runtime.unsubscribeFromGatewayChannel = RealtimeSDK.subscribeToChannel(
            Gateway.Event.getChannel(),
            this.handleOnEvent
        )
    }

    public readonly runtime = {
        unsubscribeFromGatewayChannel: null as (() => void) | null
    }

    public readonly useStore: BaseSDK.Store<GatewaySDK.State> = createWithEqualityFn(
        immer<GatewaySDK.State>(() => ({
            connections: {},
            definitions: {},
        })),
        shallow
    )

    public readonly actions: GatewaySDK.Actions = _createGatewayActions_(this)

    public override readonly query = {
        connections: {
            queryKey:  ['gateway', 'connections'] as const,
            queryFn:   () => this.actions.connection.list(),
            staleTime: CONNECTIONS_STALE_TIME,
        },
        definitions: {
            queryKey:  ['gateway', 'definitions'] as const,
            queryFn:   () => this.actions.definition.list(),
            staleTime: DEFINITIONS_STALE_TIME,
        },
    }

    public readonly selectors: GatewaySDK.Selectors = _gatewaySelectors_

    public handleOnEvent = (event: Gateway.Event) => {
        switch (event.type) {
            case 'gateway:connection:upserted':
                this.actions.connection.upsert(event.connection);
                break;

            case 'gateway:connection:removed':
                this.actions.connection.forget(event.connectionId);
                break;

            default:
                event satisfies never;
        }
    }
}

export const GatewaySDK = SDK.get<GatewaySDKImpl>("Gateway")

export namespace GatewaySDK {

    export type State = {
        connections: Record<Gateway.Connection.Id, Gateway.Connection>
        definitions: Record<Gateway.Definition.Id, Gateway.Definition>
    }

    export type Actions   = _GatewaySDKActions
    export type Selectors = _GatewaySDKSelectors
}
