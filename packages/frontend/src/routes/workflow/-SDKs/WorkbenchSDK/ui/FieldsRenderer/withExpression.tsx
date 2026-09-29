import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { Workflow } from '@pretzel-graph/shared/domain'
import { Button, Input, Tabs } from '@pretzel-graph/standard-ui/foundations'
import { SystemIcons } from '@pretzel-graph/standard-ui/icons'
import { DialogSDK } from '@pretzel-graph/standard-ui/SDKs/DialogSDK'
import { WorkbenchSDK } from '../../sdk'
import { ExpressionEditor } from '../ExpressionEditor'
import IncomingPanel from '../NodePanel/IncomingPanel'

interface Props {
    value: string
    isExpression: boolean
    onToggleExpression: (isExpression: boolean) => void
    onChange: (value: string) => void
    onCommit: () => void
    nodeId: Workflow.Node.Id
    displayName: string
    // Derivative condition fields drive structural resolution and can't become expressions —
    // suppress the static/expression toggle entirely for them.
    reconcile?: boolean
    // A blueprint-declared lock to one mode. Either way there's no second mode to switch to,
    // so the toggle is suppressed the same as for `reconcile`.
    only?: "static" | "expression"
    // item-scoped field → expose $item / $itemIndex in the expression editor's autocomplete.
    itemScoped?: boolean
    className?: string
    children: React.ReactNode
    tabClassName?: string
    togglePlacement?: 'overlay' | 'manual'
}

interface ExpressionContextValue {
    value: string
    onChange: (value: string) => void
    // the dialog content is created once (at click time) and never re-rendered with
    // fresh props as the parent re-renders — read onCommit through a ref so the dialog
    // always invokes the latest closure (current draft) instead of the one from click time.
    onCommitRef: React.RefObject<() => void>
    node: Workflow.Node.Raw | null
    displayName: string
    itemScoped?: boolean
    showToggle: boolean
    isExpression: boolean
    onToggleExpression: (isExpression: boolean) => void
}

const ExpressionContext = createContext<ExpressionContextValue | null>(null)

function useExpressionContext() {
    const ctx = useContext(ExpressionContext)
    if (!ctx) throw new Error("WithExpression.Input must be rendered inside <WithExpression>")
    return ctx
}

function ExpressionInput({ placeholder, className }: {
    placeholder?: string
    className?: string
}) {
    const { value, onChange, onCommitRef, node, displayName, itemScoped } = useExpressionContext()

    return (
        <div className='relative input-default rounded-sm overflow-hidden'>
            <SystemIcons.MathFunction className="size-3.5 absolute left-1.5 top-1/2 -translate-y-1/2" />
            <Button variant="input" size="icon-xs" className="size-5 right-0 bottom-0 rounded-none! rounded-tl-sm! absolute"
                onClick={() => {
                    if (!node) return;

                    DialogSDK.actions
                        .push("ExpressionEditorDialog", (dialogProps) => (
                            <DialogSDK.SplitTemplate
                                {...dialogProps}
                                className='h-[85vh] w-[90vw]'
                                sidebarClassName='w-[30%] p-0! overflow-hidden'
                                contentClassName='p-0! gap-0! min-w-0 overflow-hidden'
                                sidebarRenderer={() => <IncomingPanel nodeId={node.id} />}
                            >
                                <ExpressionEditor
                                    node={node}
                                    displayName={displayName}
                                    onChange={onChange}
                                    onClose={() => onCommitRef.current()}
                                    initialValue={value}
                                    itemScoped={itemScoped}
                                />
                            </DialogSDK.SplitTemplate>
                        ))
                }}
            >
                <SystemIcons.Maximize2 className="size-3.5"/>
            </Button>
            <Input
                size="sm"
                variant="default"
                value={value}
                placeholder={placeholder}
                onChange={(e) => onChange(e.currentTarget.value)}
                onBlur={() => onCommitRef.current()}
                className={className + " pl-8"}
            />
        </div>
    )
}

function ExpressionToggle() {
    const { showToggle, isExpression, onToggleExpression } = useExpressionContext()

    if (!showToggle)
        return null

    return (
        <Tabs.Root
            value={isExpression ? 'expression' : 'static'}
            onValueChange={(value) => onToggleExpression(value === 'expression')}
        >
            <Tabs.List variant="accent" size="xxs">
                <Tabs.Trigger value='expression'>Expression</Tabs.Trigger>
                <Tabs.Trigger value='static'>Static</Tabs.Trigger>
            </Tabs.List>
        </Tabs.Root>
    )
}

export function WithExpression({ value, isExpression, onToggleExpression, onChange, onCommit, nodeId, displayName, reconcile, only, itemScoped, className, children, tabClassName, togglePlacement = 'overlay' }: Props) {
    const [isHovered, setIsHovered] = useState(false)
    const node = WorkbenchSDK.document.selectors.node.get(WorkbenchSDK.document, nodeId);
    const showToggle = isHovered && !reconcile && !only

    const onCommitRef = useRef(onCommit)
    useEffect(() => { onCommitRef.current = onCommit }, [onCommit])

    return (
        <ExpressionContext.Provider value={{ value, onChange, onCommitRef, node, displayName, itemScoped, showToggle, isExpression, onToggleExpression }}>
            <div
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                className={className + " w-full nodrag cursor-auto flex flex-col gap-1 relative"}
            >
                {togglePlacement === 'overlay' && showToggle && (
                    <div className={ 'absolute -top-1 right-0 flex flex-row items-center gap-1 z-10 ' +  (!isExpression && tabClassName)}>
                        <ExpressionToggle />
                    </div>
                )}
                {children}
            </div>
        </ExpressionContext.Provider>
    )
}

WithExpression.Input = ExpressionInput
WithExpression.Toggle = ExpressionToggle
