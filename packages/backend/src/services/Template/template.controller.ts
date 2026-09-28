import { Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { Listing, Template } from '@pretzel-graph/shared/domain';
import { MemberAuthGuard } from '../../auth/member-auth.guard';
import { AuthenticatedUser } from '@/decorators/principal';
import { Principal } from '@/domain/Principal';
import { ZodBody } from '@pretzel-graph/shared/server/pipes/zod.pipe';
import { TemplateService } from './template.service';

@Controller('library/templates')
@UseGuards(MemberAuthGuard)
export class TemplateController {
    constructor(
        private readonly templateService: TemplateService,
    ) {}

    @Get()
    public async list(): Promise<Template.API.List.Response> {
        return this.templateService.list();
    }

    @Post(':listingId/remix')
    @HttpCode(200)
    public async remix(
        @AuthenticatedUser() principal: Principal.User,
        @Param('listingId') listingId: string,
        @ZodBody(Template.API.Remix.Request) body: Template.API.Remix.Request,
    ): Promise<Template.API.Remix.Response> {
        return this.templateService.remix(principal, Listing.Id.parse(listingId), body);
    }
}
