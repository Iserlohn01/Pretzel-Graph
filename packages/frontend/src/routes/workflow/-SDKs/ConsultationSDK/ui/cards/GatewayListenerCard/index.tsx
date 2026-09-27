import { Gateway } from '@pretzel-graph/shared/domain'
import { SystemIcons } from '@pretzel-graph/standard-ui/icons'
import { ExecutionSDK } from '../../../../ExecutionSDK/sdk'
import { GatewaySDK } from '@/SDKs/GatewaySDK/sdk'
import type { ConsultationSDK } from '../../../sdk'
import { ConsultationTemplate } from '../../../ui/Template'
import Sonar from '../WebhookCard/Sonar'

export interface GatewayListenerCardProps extends ConsultationSDK.TemplateProps {
    request: Gateway.Test.Consultation.Request
}

export const GatewayListenerCard = ({ request, ...templateProps }: GatewayListenerCardProps) => {

    const [connection] = GatewaySDK.useWith(
        s => s.connections[request.connectionId],
        (q) => [q.connections],
    )

    return (
        <ConsultationTemplate
            {...templateProps}
            className='!bg-card/70 !backdrop-blur-md h-[250px]'
            timeout={{
                createdAt: request.startedAt,
                timeoutMs: request.timeoutMs,
                onExpire:  () => ExecutionSDK.actions.pendingConsultations.remove(request.id),
            }}
        >
            <div className='relative h-full overflow-hidden'>
                <div className='absolute z-10 top-0 left-0 w-full px-4 pt-3'>
                    <p className='font-mono text-[11px] opacity-60'>{connection?.name ?? request.connectionId}</p>
                </div>

                <div className='absolute top-1/2 left-1/2 -translate-1/2 animate-pulse'>
                    <SystemIcons.GatewayConnection className='text-sky-300 dark:text-sky-400 size-10' />
                    <p className='absolute left-1/2 -translate-x-1/2 text-[11px] font-mono text-sky-400 text-nowrap'>Waiting for event</p>
                </div>

                <Sonar className='absolute top-1/2 left-1/2 -translate-1/2 text-cyan-600 dark:text-cyan-400 !w-[400px] !h-[400px] mask-t-from-60% mask-t-to-75%' />
            </div>
        </ConsultationTemplate>
    )
}
