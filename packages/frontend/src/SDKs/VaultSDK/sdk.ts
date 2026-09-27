import { immer } from "zustand/middleware/immer";
import { createWithEqualityFn } from "zustand/traditional";
import { shallow } from "zustand/shallow";
import { BaseSDK } from "@pretzel-graph/standard-ui/SDKs/Base";
import { SDK } from "@pretzel-graph/standard-ui/SDKs/SDKManager";
import { Vault } from "@pretzel-graph/shared/domain";
import { _createVaultActions_, type _VaultSDKActions } from "./actions";
import { _vaultSelectors_, type _VaultSDKSelectors } from "./selectors";

const INSTANCES_STALE_TIME = 30_000
const TEMPLATES_STALE_TIME = Infinity

@SDK("Vault")
export class VaultSDKImpl extends BaseSDK<VaultSDK.State> {
    constructor() { super() }

    public readonly useStore: BaseSDK.Store<VaultSDK.State> = createWithEqualityFn(
        immer<VaultSDK.State>(() => ({
            credentialInstances: {},
            credentialTemplates: {},
            selectors: _vaultSelectors_,
        })),
        shallow
    )

    public readonly actions: VaultSDK.Actions = _createVaultActions_(this)

    public override readonly query = {
        instances: {
            queryKey:  ['vault', 'instances'] as const,
            queryFn:   () => this.actions.instance.list(),
            staleTime: INSTANCES_STALE_TIME,
        },
        templates: (ids: Vault.Credential.Template.Id[]) => ({
            queryKey:  ['vault', 'templates', ...[...ids].sort()] as const,
            queryFn:   () => this.actions.template.loadBatch(ids),
            staleTime: TEMPLATES_STALE_TIME,
            enabled:   ids.length > 0,
        }),
    }
}

export const VaultSDK = SDK.get<VaultSDKImpl>("Vault")

export namespace VaultSDK {

    export type State = {
        credentialInstances: Record<Vault.Credential.Instance.Id, Vault.Credential.Instance>
        credentialTemplates: Record<Vault.Credential.Template.Id, Vault.Credential.Template>
        selectors:           VaultSDK.Selectors
    }

    export type Selectors = _VaultSDKSelectors
    export type Actions   = _VaultSDKActions
}
