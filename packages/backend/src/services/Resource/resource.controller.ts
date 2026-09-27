import { Controller, UseGuards, Get, Post, Param, HttpCode } from '@nestjs/common';
import { ResourceService } from './resource.service';
import { MemberAuthGuard } from '../../auth/member-auth.guard';
import { MemberOrDelegateGuard } from '../../auth/member-or-delegate.guard';
import { AuthenticatedUser } from '@/decorators/principal';
import { Principal } from '@/domain/Principal';
import { Dependency, Resource } from '@pretzel-graph/shared/domain';
import { ZodBody } from '@pretzel-graph/shared/server/pipes/zod.pipe';

@Controller('resources')
export class ResourceController {
    constructor(private readonly resourceService: ResourceService) { }

    @Get(':kind/:id')
    @UseGuards(MemberOrDelegateGuard)
    async load(
        @AuthenticatedUser() principal: Principal.User,
        @Param('kind') kind: Dependency.Ref.Kind,
        @Param('id') id: string,
    ) {
        const payload = Resource.API.Load.Request.parse({ kind, id });
        return await this.resourceService.load(principal, payload);
    }

    @Post('check-updates')
    @UseGuards(MemberAuthGuard)
    @HttpCode(200)
    async checkUpdates(
        @AuthenticatedUser() principal: Principal.User,
        @ZodBody(Resource.API.CheckUpdates.Request) body: Resource.API.CheckUpdates.Request,
    ) {
        return await this.resourceService.checkUpdates(principal, body);
    }
}
