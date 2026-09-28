import { Module } from '@nestjs/common';
import { CloudModule } from '../Cloud/cloud.module';
import { ListingService } from './listing.service';
import { ListingRegistry } from './registry.client';
import { DeploymentRepository } from '../Deployment/deployment.repository';

@Module({
    imports: [CloudModule],
    providers: [ListingService, ListingRegistry, DeploymentRepository],
    exports: [ListingService, ListingRegistry],
})
export class ListingModule {}
