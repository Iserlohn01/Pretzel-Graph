import { z } from "zod"
import type { AxiosInstance } from "axios";
import { Foundations } from "./Foundations";
import { SECTIONS as _SECTIONS, CORE_DRAWERS as _CORE_DRAWERS, BUNDLE_DRAWERS as _BUNDLE_DRAWERS, ALL_DRAWERS as _ALL_DRAWERS, SECTIONS } from "../constants/drawers"

export namespace Shelf {

    export namespace Drawer {
        export const Id = z.string().brand("DrawerId");
        export type Id = z.infer<typeof Id>;
    }


    export namespace Drawer {
        export const Schema = z.object({
            id: Drawer.Id,
            displayName: z.string(),
            icon: z.string(),
            blueprintIds: z.array(Foundations.Blueprint.Id),
            color: z.string().optional()
        })

        export const SECTIONS = _SECTIONS
        export const CORE_DRAWERS = _CORE_DRAWERS
        export const BUNDLE_DRAWERS = _BUNDLE_DRAWERS
        export const ALL_DRAWERS = _ALL_DRAWERS
    }

    export type Drawer = z.infer<typeof Drawer.Schema>

    export namespace Index {
        export const Schema = z.object({
            version: z.string(),
            generatedAt: z.string(),
            drawers: z.record(Drawer.Id, Drawer.Schema),
            blueprints: z.record(Foundations.Blueprint.Id, Foundations.Blueprint.Schema)
        })
    }
    export type Index = z.infer<typeof Index.Schema>

    export const Section = z.enum(["core_extended", "integrations"])
    export type Section = z.infer<typeof Section>

    // The shelf as something to search: one compact summary per blueprint, built from the loaded
    // index, and a filter that ANDs its clauses. Small enough to hand a model whole pages of.
    export namespace Catalogue {
        export interface Summary {
            id:              Foundations.Blueprint.Id
            displayName:     string
            description?:    string
            drawerId:        Drawer.Id | null
            toolCompatible:  boolean
            proxyCompatible: boolean
            /** Has derivative branches: some field values reshape the node. */
            isDerivable:     boolean
            /** Starts a run only when the run elects it; a manual run skips it. */
            isIgniter:       boolean
            /** Never starts a run; fires only when another node triggers it. */
            passive:         boolean
            fieldIds:        Foundations.Field.Id[]
            inputVariants:   Foundations.Port.Variant[]
            outputVariants:  Foundations.Port.Variant[]
        }

        export const Query = z.object({
            ids:             z.array(Foundations.Blueprint.Id).optional(),
            displayName:     z.string().optional(),
            drawerIds:       z.array(Drawer.Id).optional(),
            toolCompatible:  z.boolean().optional(),
            proxyCompatible: z.boolean().optional(),
            isDerivable:     z.boolean().optional(),
            isIgniter:       z.boolean().optional(),
            passive:         z.boolean().optional(),
            /** Has every one of these fields. */
            fieldIds:        z.array(Foundations.Field.Id).optional(),
            /** Has an input of any of these variants. */
            inputVariants:   z.array(Foundations.Port.Variant).optional(),
            /** Has an output of any of these variants. */
            outputVariants:  z.array(Foundations.Port.Variant).optional(),
            limit:           z.number().int().positive().max(500).optional(),
        })
        export type Query = z.infer<typeof Query>

        export interface Result {
            items: Summary[]
            /** How many matched before `limit`. */
            total: number
        }

        const DEFAULT_LIMIT = 50

        // Fields every node has; left out of a summary's fieldIds.
        export const FRAMEWORK_FIELD_IDS: ReadonlySet<string> = new Set(["signalDependency", "dataDependency", "onErrorStrategy", "ignition_policy"])

        const drawerOf = (() => {
            let map: Map<string, Drawer.Id> | null = null

            return (blueprintId: Foundations.Blueprint.Id): Drawer.Id | null => {
                map ??= new Map(
                    Object.values(_ALL_DRAWERS).flatMap(d => d.blueprintIds.map(id => [id, d.id as Drawer.Id] as const)),
                )
                return map.get(blueprintId) ?? null
            }
        })()

        export function summarize(bp: Foundations.Blueprint): Summary {
            return {
                id:              bp.id,
                displayName:     bp.ui.displayName,
                description:     bp.ui.description,
                drawerId:        drawerOf(bp.id),
                toolCompatible:  bp.toolCompatible  ?? false,
                proxyCompatible: bp.proxyCompatible ?? false,
                isDerivable:     Foundations.Blueprint.isDerivable(bp),
                isIgniter:       bp.igniter ?? false,
                passive:         bp.passive ?? false,
                fieldIds:        bp.fields.map(f => f.id).filter(id => !FRAMEWORK_FIELD_IDS.has(id)),
                inputVariants:   [...new Set(bp.inputs.map(p => p.variant))],
                outputVariants:  [...new Set(bp.outputs.map(p => p.variant))],
            }
        }

        export function query(summaries: readonly Summary[], q: Query): Result {
            const ids       = q.ids       && new Set<string>(q.ids)
            const drawerIds = q.drawerIds && new Set<string>(q.drawerIds)
            const needle    = q.displayName?.trim().toLowerCase()
            const inputs    = q.inputVariants  && new Set<string>(q.inputVariants)
            const outputs   = q.outputVariants && new Set<string>(q.outputVariants)

            const matches = summaries.filter(s =>
                (!ids       || ids.has(s.id)) &&
                (!drawerIds || (s.drawerId !== null && drawerIds.has(s.drawerId))) &&
                (!needle    || s.displayName.toLowerCase().includes(needle)) &&
                (q.toolCompatible  === undefined || s.toolCompatible  === q.toolCompatible) &&
                (q.proxyCompatible === undefined || s.proxyCompatible === q.proxyCompatible) &&
                (q.isDerivable     === undefined || s.isDerivable     === q.isDerivable) &&
                (q.isIgniter       === undefined || s.isIgniter       === q.isIgniter) &&
                (q.passive         === undefined || s.passive         === q.passive) &&
                (!q.fieldIds || q.fieldIds.every(id => s.fieldIds.includes(id))) &&
                (!inputs    || s.inputVariants.some(v => inputs.has(v))) &&
                (!outputs   || s.outputVariants.some(v => outputs.has(v))),
            )

            return { items: matches.slice(0, q.limit ?? DEFAULT_LIMIT), total: matches.length }
        }
    }

    export namespace API {

        export namespace Blueprint {
            export namespace Get {
                export const Request = z.object({
                    blueprintId: Foundations.Blueprint.Id
                })
                export const Response = z.object({
                    blueprint: Foundations.Blueprint.Schema
                })

                export type Request = z.infer<typeof Request>
                export type Response = z.infer<typeof Response>
            }
            export async function get(
                api: AxiosInstance,
                req: Get.Request
            ): Promise<Get.Response> {
                const { data } = await api.post<Get.Response>(
                    '/api/shelf/blueprint/get', req
                );
                return data;
            }

            export namespace GetBatch {
                export const Request = z.object({
                    blueprintIds: z.array(Foundations.Blueprint.Id)
                })
                export const Response = z.object({
                    blueprints:         z.record(Foundations.Blueprint.Id, Foundations.Blueprint.Schema),
                    resolutionFailures: z.array(Foundations.Blueprint.ResolutionFailure.Schema),
                })

                export type Request = z.infer<typeof Request>
                export type Response = z.infer<typeof Response>
            }
            export async function getBatch(
                api: AxiosInstance,
                req: GetBatch.Request
            ): Promise<GetBatch.Response> {
                const { data } = await api.post<GetBatch.Response>(
                    '/api/shelf/blueprint/getBatch', req
                )
                return data;
            }

            export namespace GetAllInSection {
                export const Request = z.object({
                    section: Section
                })
                export const Response = z.object({
                    blueprints: z.record(Foundations.Blueprint.Id, Foundations.Blueprint.Schema)
                })

                export type Request = z.infer<typeof Request>
                export type Response = z.infer<typeof Response>
            }
            export async function getAllInSection(
                api: AxiosInstance,
                req: GetAllInSection.Request
            ): Promise<GetAllInSection.Response> {
                const { data } = await api.post<GetAllInSection.Response>(
                    '/api/shelf/blueprint/getAllInSection', req
                )
                return data;
            }

        }

        // Reached from inside a run with the execution token.
        export namespace Internal {
            export namespace Query {
                export const Request = Catalogue.Query
                export type Request  = Catalogue.Query
                export type Response = Catalogue.Result
            }

            export async function query(api: AxiosInstance, req: Query.Request): Promise<Query.Response> {
                const { data } = await api.post<Query.Response>('/api/internal/shelf/blueprints/query', req)
                return data
            }

            export async function get(api: AxiosInstance, blueprintId: Foundations.Blueprint.Id): Promise<Blueprint.Get.Response> {
                const { data } = await api.get<Blueprint.Get.Response>(`/api/internal/shelf/blueprints/${encodeURIComponent(blueprintId)}`)
                return data
            }
        }
    }
}
