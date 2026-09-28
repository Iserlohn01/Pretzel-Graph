import { Module } from '@nestjs/common';
import { ListingModule } from '../Listing/listing.module';
import { ShelfModule } from '../Shelf/shelf.module';
import { LibraryModule } from '../Library/library.module';
import { TemplateController } from './template.controller';
import { TemplateService } from './template.service';

@Module({
    imports: [ListingModule, ShelfModule, LibraryModule],
    controllers: [TemplateController],
    providers: [TemplateService],
})
export class TemplateModule { }
