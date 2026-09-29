import { Button, Input } from '@pretzel-graph/standard-ui/foundations'
import { IconRenderer } from '@pretzel-graph/standard-ui/icons/IconRenderer'
import { SystemIcons } from '@pretzel-graph/standard-ui/icons'
import { Workflow } from '@pretzel-graph/shared/domain'
import { WorkbenchSDK } from '../../../sdk'
import type { NodeUI } from '@pretzel-graph/shared/domain/Workbench/Document'
import { ExecutionSDK } from '../../../../ExecutionSDK/sdk'
import { OptionsDropdown } from './OptionsDropdown'
import { DialogSDK } from '@pretzel-graph/standard-ui/SDKs/DialogSDK'
import Tipped from '@/components/Tipped'
import FloatContainer from '@/components/FloatContainer'
import type { Blueprint } from '@pretzel-graph/shared/domain/Foundations/Blueprint'
import React from 'react'

interface HeaderProps {
    hyNode: Workflow.Node.Hydrated
    isEditing: boolean
    onEditStart: () => void
    onEditFinish: () => void
}

export const NodeSidebarHeader = ({ hyNode, isEditing, onEditStart, onEditFinish }: HeaderProps) => {
    const isFullscreen = DialogSDK.useStore(s => s.selectors.isDialogOpen(s, "fullscreen-node-panel"))
    const isTool = WorkbenchSDK.useDocument(d => d.selectors.node.isTool(d, hyNode.id))
    
    const { ui, id: nodeId } = hyNode;
    const iconColor = ui.iconColor
    ? `var(--${ui.iconColor})`
    : `var(--${ui.accent}-foreground)`;

    const tintFilterId = `tool-tint-${React.useId().replace(/[^a-zA-Z0-9-_]/g, '')}`;
      const iconStyle = isTool
        ? { color: iconColor, filter: `url(#${tintFilterId})` }
        : { color: iconColor };
    
      const tintFilter = isTool && (
        <svg width="0" height="0" className="absolute" aria-hidden>
          <filter id={tintFilterId} colorInterpolationFilters="sRGB">
            <feFlood style={{ floodColor: "var(--port-Tool)" }} result="tint" />
            <feBlend in="tint" in2="SourceGraphic" mode="color" result="tinted" />
            <feComposite in="tinted" in2="SourceGraphic" operator="in" />
          </filter>
        </svg>
      );

    return (
        <div className='absolute z-10 top-2 left-2 right-2 flex flex-row gap-2'>
            <div
                className='flex items-center gap-2 px-3 py-1 rounded-full backdrop-blur-md min-w-0 max-w-xs'
                style={{
                    backgroundColor: ui.accent ? `color-mix(in srgb, var(--${ui.accent}) 25%, transparent)` : 'var(--muted)',
                }}
            >
                {tintFilter}
                <IconRenderer
                    className='my-auto h-4 w-4 shrink-0'
                    name={ui.icon ?? ""}
                    style={iconStyle}
                />
                {isEditing ? (
                    <Input
                        className='h-5 text-sm font-semibold bg-transparent shadow-none w-full min-w-0 focus-visible:ring-0 truncate'
                        defaultValue={ui.displayName}
                        autoFocus
                        onBlur={e => WorkbenchSDK.actions.node.setDisplayName(hyNode.id, e.target.value)}
                        style={{ color: ui.accent ? `var(--${ui.accent}-foreground)` : undefined }}
                    />
                ) : (
                    <h4
                        className='text-sm font-semibold truncate min-w-0'
                        style={{ color: ui.accent ? `var(--${ui.accent}-foreground)` : undefined }}
                    >
                        {ui.displayName}
                    </h4>
                )}
            </div>
            <FloatContainer className='ml-auto backdrop-blur-md'>
                {isEditing ? (
                    <div className='flex flex-row gap-2 ml-auto my-auto h-auto'>
                        <Button size="xs" className='rounded-full' variant="success" onClick={onEditFinish}>
                            Finish
                        </Button>
                    </div>
                ) : (
                    <div className='flex flex-row gap-2'>
                        <Tipped label="Run up to here">
                            <Button size="icon-xs" variant="ghost-success" onClick={() => ExecutionSDK.actions.runStep(hyNode.id)}>
                                <SystemIcons.Play />
                            </Button>
                        </Tipped>
                        <Tipped label={hyNode.isDisabled ? "Enable" : "Disable"}>
                            <Button size="icon-xs" variant="ghost" onClick={() => WorkbenchSDK.actions.node.setDisabled(hyNode.id, !hyNode.isDisabled)}
                                className={`${hyNode.isDisabled ? `bg-red-500/40` : ``}`}
                            >
                                <SystemIcons.Power className='stroke-2' />
                            </Button>
                        </Tipped>
                        {isFullscreen ? (
                            <Tipped label="Collapse">
                                <Button size="icon-xs" variant="ghost" onClick={() => WorkbenchSDK.actions.ui.closeNodePanelFullscreen()}>
                                    <SystemIcons.Minimize />
                                </Button>
                            </Tipped>
                        ) : (
                            <Tipped label="Expand">
                                <Button size="icon-xs" variant="ghost" onClick={() => WorkbenchSDK.actions.ui.openNodePanelFullscreen()}>
                                    <SystemIcons.Maximize2 />
                                </Button>
                            </Tipped>
                        )}
                        <OptionsDropdown hyNode={hyNode} onEdit={onEditStart} />
                    </div>
                )}
            </FloatContainer>
        </div>
    )
}


