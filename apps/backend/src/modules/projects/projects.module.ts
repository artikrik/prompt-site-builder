import { Module, forwardRef } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { VariantsService } from './variants/variants.service';
import { VariantsController } from './variants/variants.controller';
import { SiteEditorService } from './site-editor.service';
import { EditorController } from './editor.controller';
import { PublishingModule } from '../publishing/publishing.module';
import { GenerationModule } from '../generation/generation.module';

@Module({
  imports: [
    PublishingModule,
    forwardRef(() => GenerationModule),
  ],
  controllers: [ProjectsController, VariantsController, EditorController],
  providers: [ProjectsService, VariantsService, SiteEditorService],
  exports: [ProjectsService, VariantsService, SiteEditorService],
})
export class ProjectsModule {}
