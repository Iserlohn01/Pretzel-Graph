import type { Dependency } from "../../Dependency"
import type { Foundations } from "../../Foundations"
import type { Vault } from "../../Vault"
import type { Workflow } from "../../Workflow"
import type { Document } from "../Document"
import type { Event } from "../event"

export type Position   = { x: number, y: number }
export type Connection = Document.DriverConnection

export type BlueprintResolver = (blueprintId: Foundations.Blueprint.Id) => Promise<Foundations.Blueprint>
export type OnOperation       = (edit: Event.Unstamped) => void
/** Null when no instance has that id. */
export type CredentialResolver = (instanceId: Vault.Credential.Instance.Id) => Promise<Vault.Credential.Summary | null>
/** The snapshot a dependency embeds, taken from its source. */
export type DependencyResolver = (ref: Dependency.Ref) => Promise<Dependency.Value>

export interface CreateNodeRequest {
    blueprintId:   Foundations.Blueprint.Id
    /** Omitted: placed to the right of the rightmost node. */
    position?:     Position
    staticValues?: Record<string, unknown>
}

export type Operation =
    | ({ op: "node.create" }          & CreateNodeRequest)
    | { op: "node.delete";          nodeId: Workflow.Node.Id }
    | { op: "node.move";            nodeId: Workflow.Node.Id; position: Position }
    | { op: "node.addInputPort";    nodeId: Workflow.Node.Id; port: InputPortSpec }
    | { op: "node.removeInputPort"; nodeId: Workflow.Node.Id; portId: Foundations.Port.Input.Id }
    | { op: "node.updateInputPort"; nodeId: Workflow.Node.Id; portId: Foundations.Port.Input.Id; port: InputPortSpec }
    | ({ op: "edge.create" }          & Connection)
    | { op: "edge.delete";          edgeId: Workflow.Edge.Id }
    | { op: "field.set";            nodeId: Workflow.Node.Id; fieldId: Foundations.Field.Id; value: unknown; mode?: FieldMode }
    | { op: "credential.setInstance"; nodeId: Workflow.Node.Id; templateId: Vault.Credential.Template.Id; instanceId: Vault.Credential.Instance.Id | null }
    | ({ op: "globalField.add" }      & GlobalFieldSpec)
    | { op: "globalField.update";   fieldId: Foundations.Field.Id; patch: GlobalFieldPatch }
    | { op: "globalField.remove";   fieldId: Foundations.Field.Id }

/** A hand-added input port: a concrete type, never an unresolved one, since it belongs to no group. */
export interface InputPortSpec {
    id:          Foundations.Port.Input.Id
    displayName: string
    variant:     Foundations.Port.Variant
    required?:   boolean
}

/** Ids a caller writes for ports and global fields, so expressions can reference them. */
export const ID_PATTERN = /^[A-Za-z0-9_]+$/

export type FieldMode = "static" | "expression"

export type GlobalFieldVariant = "String" | "Boolean" | "Integer" | "Float"

export interface GlobalFieldSpec {
    id:            Foundations.Field.Id
    displayName:   string
    variant:       GlobalFieldVariant
    required?:     boolean
    tooltip?:      string
    initialValue?: string | number | boolean
    min?:          number
    max?:          number
    multiline?:    boolean
}

/** Omitted keeps the current value; null clears it. */
export type GlobalFieldPatch = Partial<Omit<GlobalFieldSpec, "id" | "tooltip" | "min" | "max">> & {
    tooltip?: string | null
    min?:     number | null
    max?:     number | null
}
