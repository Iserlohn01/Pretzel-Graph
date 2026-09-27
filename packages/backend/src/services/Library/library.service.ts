import { BadRequestException, Injectable } from '@nestjs/common';
import { Principal } from '@/domain/Principal';
import { Library, Skill, SystemError, Workflow } from '@pretzel-graph/shared/domain';
import { LibraryRepository } from './repository';
import { ListingService } from '../Listing/listing.service';

@Injectable()
export class LibraryService {
    constructor(
        private readonly libraryRepository: LibraryRepository,
        private readonly listings: ListingService,
    ) {}

    public readonly bootstrap = {
        get: async (
            principal: Principal.User,
        ): Promise<Library.API.Bootstrap.Get.Response> => {
            return this.libraryRepository.bootstrap.get(principal);
        },
    };

    public readonly folder = {
        create: async (
            principal: Principal.User,
            payload: Library.API.Folder.Create.Request,
        ): Promise<Library.API.Folder.Create.Response> => {
            return this.libraryRepository.folder.create(principal, payload);
        },

        update: async (
            principal: Principal.User,
            payload: Library.API.Folder.Update.Request,
        ): Promise<Library.API.Folder.Update.Response> => {
            if (payload.parent_folder_id !== undefined) {
                if (payload.id === Library.Folder.ROOT_ID)
                    throw new BadRequestException('The root folder cannot be moved');

                const cyclic = await this.libraryRepository.folder.isSelfOrDescendant(principal, payload.parent_folder_id, payload.id);

                if (cyclic)
                    throw new BadRequestException('A folder cannot be moved into itself');
            }

            return this.libraryRepository.folder.update(principal, payload);
        },

        delete: async (
            principal: Principal.User,
            id: Library.Folder.Id,
        ): Promise<Library.API.Folder.Remove.Response> => {
            if (id === Library.Folder.ROOT_ID)
                throw new BadRequestException('The root folder cannot be deleted');

            // Connections own live sockets, so they are never deleted along with a folder.
            const connectionIds = await this.libraryRepository.folder.listNestedConnectionIds(principal, id);

            if (connectionIds.length > 0) {
                const noun = connectionIds.length === 1 ? 'connection' : 'connections';

                throw new SystemError(SystemError.Code.CONFLICT, `Delete the ${connectionIds.length} ${noun} inside this folder first`);
            }

            await this.libraryRepository.folder.delete(principal, id);

            return { ok: true };
        },

        getContents: async (
            principal: Principal.User,
            id: Library.Folder.Id,
        ): Promise<Library.API.Folder.GetContents.Response> => {
            return this.libraryRepository.folder.getContents(principal, id);
        }
    };

    public readonly workflow = {
        create: async (
            principal: Principal.User,
            payload: Library.API.Workflow.Create.Request,
        ): Promise<Library.API.Workflow.Create.Response> => {
            return this.libraryRepository.workflow.create(principal, payload);
        },

        get: async (
            principal: Principal.User,
            workflowId: Workflow.Id,
        ): Promise<Library.API.Workflow.Get.Response> => {
            return this.libraryRepository.workflow.get(principal, workflowId);
        },

        update: async (
            principal: Principal.User,
            payload: Library.API.Workflow.Update.Request,
        ): Promise<Library.API.Workflow.Update.Response> => {
            return this.libraryRepository.workflow.update(principal, payload);
        },

        delete: async (
            principal: Principal.User,
            id: Workflow.Id,
        ): Promise<Library.API.Workflow.Remove.Response> => {
            await this.listings.unshareWorkflow(id);
            await this.libraryRepository.workflow.delete(principal, id);

            // After the commit — the cached owner is still correct until the TTL, and would
            // keep authorizing routes against a row that no longer exists.

            return { ok: true };
        },

        duplicate: async (
            principal: Principal.User,
            id: Workflow.Id,
        ): Promise<Library.API.Workflow.Duplicate.Response> => {
            return this.libraryRepository.workflow.duplicate(principal, id);
        },
    };

    public readonly skill = {
        create: async (
            principal: Principal.User,
            payload: Library.API.Skill.Create.Request,
        ): Promise<Library.API.Skill.Create.Response> => {
            return rethrowNameConflict(payload.name, this.libraryRepository.skill.create(principal, payload));
        },

        get: async (
            principal: Principal.User,
            id: Skill.Id,
        ): Promise<Library.API.Skill.Get.Response> => {
            return this.libraryRepository.skill.get(principal, id);
        },

        update: async (
            principal: Principal.User,
            payload: Library.API.Skill.Update.Request,
        ): Promise<Library.API.Skill.Update.Response> => {
            return rethrowNameConflict(payload.name, this.libraryRepository.skill.update(principal, payload));
        },

        delete: async (
            principal: Principal.User,
            id: Skill.Id,
        ): Promise<Library.API.Skill.Remove.Response> => {
            await this.libraryRepository.skill.delete(principal, id);

            return { ok: true };
        },
    };
}

// A skill's name is its only unique column, so a conflict on a write means the name is taken.
async function rethrowNameConflict<T>(name: string | undefined, write: Promise<T>): Promise<T> {
    try {
        return await write;
    }
    catch (err) {
        if (name && err instanceof SystemError && err.code === SystemError.Code.CONFLICT)
            throw new SystemError(SystemError.Code.CONFLICT, `A skill named "${name}" already exists`);

        throw err;
    }
}
