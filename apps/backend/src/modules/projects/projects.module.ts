import { Module } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { VariantsService } from './variants/variants.service';
import { VariantsController } from './variants/variants.controller';

@Module({
  controllers: [ProjectsController, VariantsController],
  providers: [ProjectsService, VariantsService],
  exports: [ProjectsService, VariantsService],
})
export class ProjectsModule {}
