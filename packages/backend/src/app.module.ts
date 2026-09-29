import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, DiscoveryModule } from '@nestjs/core';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { REDIS_HOST, REDIS_PORT, REDIS_PASSWORD } from "@pretzel-graph/shared/constants";
import { ExecutionModule } from './services/Execution/execution.module';
import { ChatModule } from './services/Chat/chat.module';
import { LibraryModule } from './services/Library/library.module';
import { ShelfModule } from './services/Shelf/shelf.module';
import { WorkbenchModule } from './services/Workbench/workbench.module';
import { ResourceModule } from './services/Resource/resource.module';
import { RealtimeModule } from './services/Realtime/realtime.module';
import { GlobalExceptionFilter } from './filters/global-exception.filter';
import { UserModule } from './services/User/user.module';
import { VersionControlModule } from './services/VersionControl/version-control.module';
import { DeploymentModule } from './services/Deployment/deployment.module';
import { WebhookTestModule } from './services/WebhookTest/webhook-test.module';
import { PermissionModule } from './services/Permission/permission.module';
import { MemberModule } from './services/Member/member.module';
import { WebhookIgnitionModule } from './services/WebhookIgnition/webhook-ignition.module';
import { ApiKeysModule } from './services/ApiKeys/api-keys.module';
import { VaultModule } from './services/Vault/vault.module';
import { ConsultationModule } from './services/Consultation/consultation.module';
import { HealthModule } from './services/Health/health.module';
import { ListingModule } from './services/Listing/listing.module';
import { TemplateModule } from './services/Template/template.module';
import { ActivityModule } from './services/Activity/activity.module';
import { WorkerModule } from './services/Worker/worker.module';
import { GatewayModule } from './services/Gateway/gateway.module';
import { GatewayIgnitionModule } from './services/GatewayIgnition/gateway-ignition.module';

@Module({
    imports: [
        DiscoveryModule,
        // Rate limiting: max 100 requests per 60 seconds per IP
        ThrottlerModule.forRoot({
            throttlers: [{ ttl: 60000, limit: 100 }],
        }),
        BullModule.forRoot({
            connection: {
                host: REDIS_HOST,
                port: REDIS_PORT,
                password: REDIS_PASSWORD,
            },
            defaultJobOptions: {
                removeOnComplete: { count: 20 },
                removeOnFail: { count: 50 },
            },
        }),
        ExecutionModule,
        ChatModule,
        LibraryModule,
        ShelfModule,
        WorkbenchModule,
        ResourceModule,
        RealtimeModule,
        UserModule,
        VersionControlModule,
        DeploymentModule,
        WebhookTestModule,
        PermissionModule,
        MemberModule,
        WebhookIgnitionModule,
        ApiKeysModule,
        VaultModule,
        ConsultationModule,
        HealthModule,
        ListingModule,
        TemplateModule,
        ActivityModule,
        WorkerModule,
        GatewayModule,
        GatewayIgnitionModule,
    ],
    controllers: [],
    providers: [
        // Apply rate limiting globally to all endpoints
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    ],
})
export class AppModule { }
