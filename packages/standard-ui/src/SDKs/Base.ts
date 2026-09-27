import type { StoreApi, UseBoundStore } from "zustand"
import { useQueries, type UseQueryResult } from "@tanstack/react-query"
import { QuerySDK } from "./QuerySDK/sdk"

export abstract class BaseSDK<T_State> {
    protected constructor() { }

    public abstract readonly useStore: BaseSDK.Store<T_State>

    declare public readonly query: object

    /** Clear session-scoped state and runtime resources when authentication ends. */
    public cleanup(): void { }

    public useWith = <Selected, const Queries extends readonly BaseSDK.Query[]>(
        selector: (state: T_State) => Selected,
        queries: (query: this['query']) => Queries,
    ) => {
        const results = useQueries({ queries: queries(this.query) }) as BaseSDK.QueryResults<Queries>

        const selected = this.useStore(selector)

        return [selected, results] as const
    }

    public fetch = <Result>(query: BaseSDK.Query<Result>): Promise<Result> =>
        QuerySDK.client.fetchQuery(query)

    public prefetch = (query: BaseSDK.Query): Promise<void> =>
        QuerySDK.client.prefetchQuery(query)

    public invalidate = (query: BaseSDK.Query): Promise<void> =>
        QuerySDK.client.invalidateQueries({ queryKey: query.queryKey })

    public get state() { return this.useStore.getState() }
    public get subscribe() { return this.useStore.subscribe }
    public get setState() { return this.useStore.setState }
}

export namespace BaseSDK {
    export type Query<Result = unknown> = {
        queryKey: readonly unknown[]
        queryFn: () => Promise<Result>
        staleTime?: number
        enabled?: boolean
        retry?: number
        retryDelay?: (attemptIndex: number) => number
        initialData?: Result
    }

    export type QueryResults<Queries extends readonly Query[]> = {
        [Index in keyof Queries]: Queries[Index] extends Query<infer Result>
            ? UseQueryResult<Result, Error>
            : never
    }

    export type Store<T> = UseBoundStore<StoreApi<T>> & {
        setState: {
            (nextStateOrUpdater: T | Partial<T> | ((state: T) => void), shouldReplace?: false | undefined): void;
            (nextStateOrUpdater: T | ((state: T) => void), shouldReplace: true): void;
        }
    }
}
