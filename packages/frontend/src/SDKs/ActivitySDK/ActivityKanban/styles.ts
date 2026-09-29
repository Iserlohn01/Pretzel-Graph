import { cva } from 'class-variance-authority'
import type { Execution, Library } from '@pretzel-graph/shared/domain'


export function iconColor(workflow: Library.WorkflowMeta) {
    const token = workflow.icon_color ?? workflow.accent

    return token ? `var(--${token})` : "var(--primary--foreground)"
}


// Written out rather than built from a token name: Tailwind only emits an
// arbitrary property it can read literally in the source.
const STATUS_TINT = {
    pending: "[--frame-panel-bg:color-mix(in_srgb,var(--muted-foreground)_6%,var(--card))]   [--frame-panel-border-color:color-mix(in_srgb,var(--muted-foreground)_20%,transparent)]",
    running: "[--frame-panel-bg:color-mix(in_srgb,var(--active-foreground)_10%,var(--card))]   [--frame-panel-border-color:color-mix(in_srgb,var(--info-foreground)_35%,transparent)]",
    paused: "[--frame-panel-bg:color-mix(in_srgb,var(--warning)_10%,var(--card))]           [--frame-panel-border-color:color-mix(in_srgb,var(--warning)_35%,transparent)]",
    suspended: "[--frame-panel-bg:color-mix(in_srgb,var(--warning)_10%,var(--card))]           [--frame-panel-border-color:color-mix(in_srgb,var(--warning)_35%,transparent)]",
    completed: "[--frame-panel-bg:color-mix(in_srgb,var(--success-foreground)_10%,var(--card))] [--frame-panel-border-color:color-mix(in_srgb,var(--success-foreground)_35%,transparent)]",
    failed: "[--frame-panel-bg:color-mix(in_srgb,var(--destructive)_10%,var(--card))]       [--frame-panel-border-color:color-mix(in_srgb,var(--destructive)_35%,transparent)]",
    terminated: "[--frame-panel-bg:color-mix(in_srgb,var(--destructive)_6%,var(--card))]        [--frame-panel-border-color:color-mix(in_srgb,var(--destructive)_20%,transparent)]",
    // Keyed by the enum, so adding a status fails to compile until it has a tint.
} satisfies Record<Execution.Status, string>

// Frame.Panel paints from these two properties, so a status recolours it without
// competing with the classes it already carries.
export const executionVariants = cva(
    [],
    {
        variants: {
            status: STATUS_TINT,
        },
        defaultVariants: {
            status: "pending",
        },
    }
)


const STATUS_BADGE_TINT = {
    pending: "border-[color-mix(in_srgb,var(--muted-foreground)_35%,transparent)]   bg-[color-mix(in_srgb,var(--muted-foreground)_18%,transparent)]   text-[var(--muted-foreground)]",
    running: "border-[color-mix(in_srgb,var(--active-foreground)_45%,transparent)]  bg-[color-mix(in_srgb,var(--active-foreground)_20%,transparent)]  text-[var(--active-foreground)]",
    paused: "border-[color-mix(in_srgb,var(--warning)_45%,transparent)]            bg-[color-mix(in_srgb,var(--warning)_20%,transparent)]            text-[var(--warning-foreground)]",
    suspended: "border-[color-mix(in_srgb,var(--warning)_45%,transparent)]            bg-[color-mix(in_srgb,var(--warning)_20%,transparent)]            text-[var(--warning-foreground)]",
    completed: "border-[color-mix(in_srgb,var(--success-foreground)_40%,transparent)] bg-[color-mix(in_srgb,var(--success-foreground)_16%,transparent)] text-[var(--success-foreground)]",
    failed: "border-[color-mix(in_srgb,var(--destructive)_45%,transparent)]        bg-[color-mix(in_srgb,var(--destructive)_20%,transparent)]        text-[var(--destructive)]",
    terminated: "border-[color-mix(in_srgb,var(--destructive)_30%,transparent)]        bg-[color-mix(in_srgb,var(--destructive)_12%,transparent)]        text-[var(--destructive)]",
} satisfies Record<Execution.Status, string>

// A box inside the item, so it paints itself rather than the frame properties.
export const executionStatusVariants = cva(
    ["inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] leading-none"],
    {
        variants: {
            status: STATUS_BADGE_TINT,
        },
        defaultVariants: {
            status: "pending",
        },
    }
)
