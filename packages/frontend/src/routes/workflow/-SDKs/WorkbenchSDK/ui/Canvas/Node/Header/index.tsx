import React from 'react'
import { Execution, Workflow } from '@pretzel-graph/shared/domain';
import MinimizedHandles from './MinimizedHandles';
import { IconRenderer } from '@pretzel-graph/standard-ui/icons/IconRenderer';
import StatusIndicator from './StatusIndicator';
import type { NodeUI } from '@pretzel-graph/shared/domain/Workbench/Document';
import { WorkbenchSDK } from '../../../../sdk';

interface Props {
  hyNode: Workflow.Node.Hydrated
  executionStatus: Execution.Session.NodeStatus
}

export const NodeHeader: React.FC<Props> = ({ hyNode, executionStatus }) => {
  const hasUpdate = WorkbenchSDK.useDocument(d => d.selectors.node.dependency.hasUpdates(d, hyNode.id))
  const isTool = WorkbenchSDK.useDocument(d => d.selectors.node.isTool(d, hyNode.id))


  const { ui, id: nodeId } = hyNode;
  const isMinimized = ui.isMinimized;
  const isFlipped = ui.isFlipped;
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

    
  if (isMinimized)
    return (
      <MinimizedHandles inputs={hyNode.inputs} outputs={hyNode.outputs} nodeId={nodeId} isFlipped={isFlipped}>
        <div className='px-5 py-1 h-fit my-auto'>
          {tintFilter}
          <IconRenderer
            className={`w-11 h-11 ${isFlipped ? "scale-x-[-1]" : ""}`}
            name={ui.icon ?? ""}
            style={iconStyle}
          />
        </div>
        <div className='absolute -bottom-1 -right-5'>
          <StatusIndicator executionStatus={executionStatus} nodeId={nodeId} hasUpdate={hasUpdate} />
        </div>
        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 truncate text-xs font-semibold text-foreground/80">
          {ui.displayName}
        </div>
      </MinimizedHandles>
    )

  return (
    <div className="flex w-full items-center gap-3 px-5 py-1.5 rounded-t-xl " >
      {tintFilter}
      <IconRenderer
        className={`${isMinimized ? "w-8 h-8" : "w-5.5 h-5.5"} ${isFlipped ? "scale-x-[-1]" : ""}`}
        name={ui.icon ?? ""}
        style={iconStyle}
      />
      <div className="flex-1 truncate font-semibold text-foreground/80">
        {ui.displayName}
      </div>
      <StatusIndicator executionStatus={executionStatus} nodeId={nodeId} hasUpdate={hasUpdate} />

    </div>
  )
}