import { WorkbenchSDK } from '@/routes/workflow/-SDKs/WorkbenchSDK/sdk'
import { Button, Dialog } from '@pretzel-graph/standard-ui/foundations'
import { SystemIcons } from '@pretzel-graph/standard-ui/icons'
import type { Workflow } from '@pretzel-graph/shared/domain'
import React, { memo } from 'react'
import { OptionsDropdown } from './OptionsDropdown'
import Tipped from '@/components/Tipped'
import type { Blueprint } from '@pretzel-graph/shared/domain/Foundations/Blueprint'
import { PROXY_TEMPLATE_ID } from '../../../NodePanel/proxy'
import { CredentialRenderer } from '../../../CredentialsRenderer';
import { DialogSDK } from '@pretzel-graph/standard-ui/SDKs/DialogSDK'
import { NodeToolbar, Position } from '@xyflow/react'

interface Props {
    hyNode: Workflow.Node.Hydrated
}

export const NodeCustomToolbar: React.FC<Props> = memo(({ hyNode }) => {

    const isNodeClicked = WorkbenchSDK.useStore(s => s.clickedNodeId === hyNode.id)

    // Mount only when clicked. NodeToolbar subscribes to the viewport transform to keep
    // its screen position, so an always-mounted one re-renders every node on every
    // pan/zoom frame — 144 nodes → 144 re-renders/frame.
    if (!isNodeClicked)
        return null

    return (
        <NodeToolbar isVisible position={Position.Top}>
            <div className="animate-in fade-in-0 slide-in-from-bottom-4 duration-200 ease-out origin-bottom">
                <ToolbarContent hyNode={hyNode}/>
            </div>
        </NodeToolbar>
    )
})

const ToolbarContent: React.FC<Props> = memo(({ hyNode }) => {

    const nodeId = hyNode.id

    const [shapeDependencyRef, updateCount] = WorkbenchSDK.useDocument(d => {
        const shapeDependencyRef = d.selectors.node.dependency.getShapeRef(d, nodeId)
        const updateCount = d.selectors.node.dependency.getUpdates(d, nodeId).length

        return [shapeDependencyRef, updateCount]
    })


    const showExtrasPanel = updateCount || shapeDependencyRef  || hyNode.blueprint.toolCompatible || hyNode.blueprint.proxyCompatible

    const openDependencyUpdater = () => {
        const document = WorkbenchSDK.document

        WorkbenchSDK.dialogs.openDependencyUpdater(
            WorkbenchSDK.selectors.node.dependency.getUpdates(document, nodeId),
            "Update dependencies for this node",
        )
    }

    return (
        <div className='flex flex-row gap-1'>
            <div className='bg-card border border-border rounded-full p-0.5 gap-1 flex flex-row shadow-md shadow-black/10'>
                <Tipped label={hyNode.ui?.isMinimized ? "Expand" : "Collapse"}>
                    <Button variant="ghost" size="icon-xs" className='h-6!'
                        onClick={() => {
                            WorkbenchSDK.actions.node.setMinimized(hyNode.id, !hyNode.ui?.isMinimized)
                        }}
                    >
                        {hyNode.ui?.isMinimized ?
                            <SystemIcons.Maximize2 />
                            :
                            <SystemIcons.Minimize2 />
                        }
                    </Button>
                </Tipped>
                <Tipped label="Flip">
                    <Button variant="ghost" size="icon-xs" className='h-6!'
                        onClick={() => {
                            WorkbenchSDK.actions.node.setFlipped(hyNode.id, !hyNode.ui?.isFlipped)
                        }}
                    >
                        <SystemIcons.ArrowLeftRight />
                    </Button>
                </Tipped>
                
                {/* <Tipped label="Run">
                    <Button variant="ghost-success" size="icon-xs" className='text-xs'>
                        <SystemIcons.Play />
                    </Button>
                </Tipped> */}
                <OptionsDropdown node={hyNode}/>
            </div>
            {showExtrasPanel && (
                <div className='bg-card flex flex-row gap-1 border-border border rounded-full h-[30px] p-0.5 shadow-md shadow-black/10'>
                    {hyNode.blueprint.toolCompatible && (
                        <ToolButton nodeId={hyNode.id} />
                    )}
                    {shapeDependencyRef && (
                        <Tipped label="Open workflow">
                            <Button variant="ghost-primary" size="xs" className='h-6! px-1! font-semibold rounded-full!'
                                onClick={() => WorkbenchSDK.openWorkflowWindow(shapeDependencyRef.id)}
                            >
                                <SystemIcons.Graph className='size-3.5'/>
                                Open 
                            </Button>
                        </Tipped>
                    )}
                    {updateCount > 0 &&
                        <Tipped label={updateCount === 1 ? "Update dependency" : `Update ${updateCount} dependencies`}>
                            <Button variant="ghost-active" size="icon-xs" className='h-6!'
                                onClick={openDependencyUpdater}
                            >
                                <SystemIcons.ArrowBigUpDash />
                            </Button>
                        </Tipped>
                    }
                    {hyNode.blueprint.proxyCompatible && 
                        <ProxyButton nodeId={hyNode.id} />
                    }
                </div>
            )}
        </div>
    )
})

const ProxyButton = memo(({ nodeId }: { nodeId: Workflow.Node.Id }) => {
    const proxyTemplate = WorkbenchSDK.useDocument(d =>
        d.selectors.credential.getTemplate(d, nodeId, PROXY_TEMPLATE_ID)
    )
    const [proxyInstanceId, setProxyInstance] = WorkbenchSDK.useCredential(nodeId, PROXY_TEMPLATE_ID)

    const openProxyConfigurationDialog = () => {
        if (!proxyTemplate)
            return

        const dialogId = `proxy-config-${nodeId}`

        DialogSDK.actions.push(dialogId, props => (
            <DialogSDK.SplitTemplate {...props}
                className='h-[400px]'
                sidebarClassName='w-[270px]'
                contentClassName='w-[400px]'
                sidebarRenderer={() => (
                    <DialogSDK.SplitTemplate.Header>
                        <DialogSDK.SplitTemplate.Icon icon={SystemIcons.NetworkProxy} />
                        <DialogSDK.SplitTemplate.Title>Network Proxy</DialogSDK.SplitTemplate.Title>
                        <DialogSDK.SplitTemplate.Description>
                            Route this node's outbound requests through a proxy.
                        </DialogSDK.SplitTemplate.Description>
                    </DialogSDK.SplitTemplate.Header>
                )}
            >
                <Dialog.Title className='hidden'>Network Proxy</Dialog.Title>
                <Dialog.Description className='hidden'>Route this node's outbound requests through a proxy</Dialog.Description>
                <div className='flex flex-col gap-2 h-full pt-3'>
                    <p className='text-xs font-medium text-muted-foreground '>Select a Network Proxy Credential</p>
                    <CredentialRenderer credentialTemplate={proxyTemplate} nodeId={nodeId} showTitle={false} />

                    <div className='flex flex-row justify-between mt-auto'>
                        <Dialog.Action variant='ghost-destructive' size='sm' onClick={() => setProxyInstance(null)}>
                            Remove Proxy
                        </Dialog.Action>
                        <Dialog.Action size='sm' onClick={() => DialogSDK.actions.pop(dialogId)}>
                            Done
                        </Dialog.Action>
                    </div>
                </div>
            </DialogSDK.SplitTemplate>
        ))
    }

    return (
        <Tipped label={"Configure Network Proxy"}>
            <Button variant="ghost" size="icon-xs" className={`h-6! ${proxyInstanceId ? 'bg-blue-500/20 ' : ''} `}
                onClick={openProxyConfigurationDialog}
            >
                <SystemIcons.NetworkProxy />
            </Button>
        </Tipped>
    );
});

const ToolButton = memo(({ nodeId }: { nodeId: Workflow.Node.Id }) => {
    const isTool = WorkbenchSDK.useDocument(d => d.selectors.node.isTool(d, nodeId));

    return (
        <Tipped label={isTool ? "Revert to Node" : "Convert to Tool"}>
            <Button variant="ghost" size="icon-xs" className={`h-6! ${isTool ? 'bg-(--port-Tool)/20 ' : ''} text-(--port-Tool) `}
                onClick={() => {
                    if (isTool) 
                        WorkbenchSDK.actions.tool.revert(nodeId);
                    else 
                        WorkbenchSDK.actions.tool.convert(nodeId);
                }}
            >
                <SystemIcons.Tool />
            </Button>
        </Tipped>
    );
});
