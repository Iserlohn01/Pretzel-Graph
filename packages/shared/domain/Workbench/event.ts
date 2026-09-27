import z from "zod"
import { Realtime } from "../Realtime"
import { Workflow } from "../Workflow"
import { Foundations } from "../Foundations"
import { Vault } from "../Vault"
import { Dependency } from "../Dependency"
import { ExecutionId } from "../Execution/ids"

// One channel per workflow: workbench:<workflowId>. Carries what happens to a workflow as a
// document rather than as a run — who holds it, and each edit the holder makes.
export namespace Event {
    export const Channel = Realtime.Channel.brand("Workbench.Event.Channel")
    export type Channel = z.infer<typeof Channel>

    export const getChannel = (workflowId: Workflow.Id) => `workbench:${workflowId}` as Channel

    const Base = Realtime.Event.Base.extend({
        channel:     Channel,
        workflowId:  Workflow.Id,
        executionId: ExecutionId,
    })

    const Position     = z.object({ x: z.number(), y: z.number() })
    const StaticValues = z.record(z.string(), z.unknown())

    export namespace Lock {
        export const Acquired = Base.extend({ type: z.literal("lock:acquired") })
        export const Released = Base.extend({ type: z.literal("lock:released") })
        export type Acquired = z.infer<typeof Acquired>
        export type Released = z.infer<typeof Released>
    }

    // Each edit carries what a listener needs to make the same change to its own document.
    // Values travel, blueprints never do: a listener resolves the base itself and refolds.
    export namespace Node {
        export const Created = Base.extend({
            type:         z.literal("node:created"),
            node:         Workflow.Node.Raw.Schema,
            position:     Position,
            staticValues: StaticValues,
        })
        export const Deleted = Base.extend({
            type:   z.literal("node:deleted"),
            nodeId: Workflow.Node.Id,
        })
        export const Moved = Base.extend({
            type:     z.literal("node:moved"),
            nodeId:   Workflow.Node.Id,
            position: Position,
        })
        export const InputPortAdded = Base.extend({
            type:   z.literal("node:inputPortAdded"),
            nodeId: Workflow.Node.Id,
            port:   Foundations.Port.Input.Schema,
        })
        export const InputPortRemoved = Base.extend({
            type:   z.literal("node:inputPortRemoved"),
            nodeId: Workflow.Node.Id,
            portId: Foundations.Port.Input.Id,
        })
        export const InputPortUpdated = Base.extend({
            type:   z.literal("node:inputPortUpdated"),
            nodeId: Workflow.Node.Id,
            portId: Foundations.Port.Input.Id,
            port:   Foundations.Port.Input.Schema,
        })
        export type Created          = z.infer<typeof Created>
        export type Deleted          = z.infer<typeof Deleted>
        export type Moved            = z.infer<typeof Moved>
        export type InputPortAdded   = z.infer<typeof InputPortAdded>
        export type InputPortRemoved = z.infer<typeof InputPortRemoved>
        export type InputPortUpdated = z.infer<typeof InputPortUpdated>
    }

    export namespace Edge {
        export const Created = Base.extend({
            type:   z.literal("edge:created"),
            edgeId: Workflow.Edge.Id,
        })
        export const Deleted = Base.extend({
            type:   z.literal("edge:deleted"),
            edgeId: Workflow.Edge.Id,
        })
        export type Created = z.infer<typeof Created>
        export type Deleted = z.infer<typeof Deleted>
    }

    export namespace Field {
        export const Set = Base.extend({
            type:    z.literal("field:set"),
            nodeId:  Workflow.Node.Id,
            fieldId: Foundations.Field.Id,
            value:   z.unknown(),
        })
        export type Set = z.infer<typeof Set>

        export const ModeSet = Base.extend({
            type:    z.literal("field:modeSet"),
            nodeId:  Workflow.Node.Id,
            fieldId: Foundations.Field.Id,
            mode:    z.enum(["static", "expression"]),
        })
        export type ModeSet = z.infer<typeof ModeSet>

        export const DependencySet = Base.extend({
            type:    z.literal("field:dependencySet"),
            nodeId:  Workflow.Node.Id,
            fieldId: Foundations.Field.Id,
            ref:     Dependency.Ref.Schema,
        })
        export type DependencySet = z.infer<typeof DependencySet>
    }

    export namespace Credential {
        export const InstanceSet = Base.extend({
            type:       z.literal("credential:instanceSet"),
            nodeId:     Workflow.Node.Id,
            templateId: Vault.Credential.Template.Id,
            instanceId: Vault.Credential.Instance.Id.nullable(),
        })
        export type InstanceSet = z.infer<typeof InstanceSet>
    }

    export namespace Workflow_ {
        export const GlobalFieldsChanged = Base.extend({
            type:         z.literal("workflow:globalFieldsChanged"),
            globalFields: z.array(Foundations.Field.Schema),
        })
        export type GlobalFieldsChanged = z.infer<typeof GlobalFieldsChanged>
    }

    export const Schema = z.discriminatedUnion("type", [
        Workflow_.GlobalFieldsChanged,
        Lock.Acquired, Lock.Released,
        Node.Created,  Node.Deleted, Node.Moved, Node.InputPortAdded, Node.InputPortRemoved, Node.InputPortUpdated,
        Edge.Created,  Edge.Deleted,
        Field.Set,    Field.ModeSet, Field.DependencySet,
        Credential.InstanceSet,
    ])

    /** The addressing the backend stamps; what an emitter supplies is the rest. */
    export type Unstamped<T extends Event = Event> = T extends Event ? Omit<T, "channel" | "workflowId" | "executionId"> : never
}
export type Event = z.infer<typeof Event.Schema>
