import { Controller, Post, Get, Delete, Body, Param, UseGuards, HttpCode, Patch } from '@nestjs/common';
import { LibraryService } from './library.service';
import { Library, Skill, Workflow } from '@pretzel-graph/shared/domain';
import { MemberAuthGuard } from '../../auth/member-auth.guard';
import { AuthenticatedUser } from '@/decorators/principal';
import { Principal } from '@/domain/Principal';
import { ZodBody } from '@pretzel-graph/shared/server/pipes/zod.pipe';

@Controller('library')
@UseGuards(MemberAuthGuard)
export class LibraryController {
    constructor(
        private readonly libraryService: LibraryService,
    ) {}

    // ── Bootstrap ─────────────────────────────────────────
    @Get('bootstrap')
    async getBootstrap(@AuthenticatedUser() principal: Principal.User) {
        return await this.libraryService.bootstrap.get(principal);
    }

    // ── Folders ───────────────────────────────────────────
    @Post('folders')
    @HttpCode(200)
    async createFolder(
        @AuthenticatedUser() principal: Principal.User,
        @ZodBody(Library.API.Folder.Create.Request) body: Library.API.Folder.Create.Request,
    ) {
        return await this.libraryService.folder.create(principal, body);
    }

    @Patch('folders/:id')
    async updateFolder(@AuthenticatedUser() principal: Principal.User, @Param('id') id: Library.Folder.Id, @Body() body: Omit<Library.API.Folder.Update.Request, 'id'>) {
        const payload = Library.API.Folder.Update.Request.parse({ ...body, id });
        return await this.libraryService.folder.update(principal, payload);
    }

    @Delete('folders/:id')
    async deleteFolder(@AuthenticatedUser() principal: Principal.User, @Param('id') id: Library.Folder.Id) {
        return await this.libraryService.folder.delete(principal, id);
    }

    @Get('folders/:id/contents')
    async getFolderContents(@AuthenticatedUser() principal: Principal.User, @Param('id') id: Library.Folder.Id) {
        return await this.libraryService.folder.getContents(principal, id);
    }


    // ── Workflows ─────────────────────────────────────────
    @Post('workflows')
    @HttpCode(200)
    async createWorkflow(
        @AuthenticatedUser() principal: Principal.User,
        @ZodBody(Library.API.Workflow.Create.Request) body: Library.API.Workflow.Create.Request,
    ) {
        return await this.libraryService.workflow.create(principal, body);
    }

    @Get('workflows/:id')
    async getWorkflow(@AuthenticatedUser() principal: Principal.User, @Param('id') id: Workflow.Id) {
        return await this.libraryService.workflow.get(principal, id);
    }

    @Patch('workflows/:id')
    async updateWorkflow(@AuthenticatedUser() principal: Principal.User, @Param('id') id: Workflow.Id, @Body() body: Omit<Library.API.Workflow.Update.Request, 'id'>) {
        const payload = Library.API.Workflow.Update.Request.parse({ ...body, id });
        return await this.libraryService.workflow.update(principal, payload);
    }

    @Delete('workflows/:id')
    async deleteWorkflow(@AuthenticatedUser() principal: Principal.User, @Param('id') id: Workflow.Id) {
        return await this.libraryService.workflow.delete(principal, id);
    }

    @Post('workflows/:id/duplicate')
    @HttpCode(200)
    async duplicateWorkflow(@AuthenticatedUser() principal: Principal.User, @Param('id') id: Workflow.Id) {
        return await this.libraryService.workflow.duplicate(principal, id);
    }


    // ── Skills ────────────────────────────────────────────
    @Post('skills')
    @HttpCode(200)
    async createSkill(
        @AuthenticatedUser() principal: Principal.User,
        @ZodBody(Library.API.Skill.Create.Request) body: Library.API.Skill.Create.Request,
    ) {
        return await this.libraryService.skill.create(principal, body);
    }

    @Get('skills/:id')
    async getSkill(@AuthenticatedUser() principal: Principal.User, @Param('id') id: Skill.Id) {
        return await this.libraryService.skill.get(principal, id);
    }

    @Patch('skills/:id')
    async updateSkill(@AuthenticatedUser() principal: Principal.User, @Param('id') id: Skill.Id, @Body() body: Omit<Library.API.Skill.Update.Request, 'id'>) {
        const payload = Library.API.Skill.Update.Request.parse({ ...body, id });
        return await this.libraryService.skill.update(principal, payload);
    }

    @Delete('skills/:id')
    async deleteSkill(@AuthenticatedUser() principal: Principal.User, @Param('id') id: Skill.Id) {
        return await this.libraryService.skill.delete(principal, id);
    }
}
