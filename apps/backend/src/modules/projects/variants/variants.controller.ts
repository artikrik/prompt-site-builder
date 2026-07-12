import { Controller, Get, Post, Put, Delete, Param, Body, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../../../shared/guards/jwt-auth.guard';
import { VariantsService } from './variants.service';
import { CreateVariantDto } from '@prompt-site-builder/shared';

@Controller()
@UseGuards(JwtAuthGuard)
export class VariantsController {
  constructor(private readonly variantsService: VariantsService) {}

  @Post('projects/:id/variants')
  async create(@Param('id') id: string, @Body() dto: CreateVariantDto) {
    const variant = await this.variantsService.create(id, dto);
    return { variant };
  }

  @Get('projects/:id/variants')
  async list(@Param('id') id: string) {
    return this.variantsService.findByProject(id);
  }

  @Get('variants/:variantId')
  async getOne(@Param('variantId') variantId: string) {
    return this.variantsService.findById(variantId);
  }

  @Put('variants/:variantId/activate')
  async activate(@Param('variantId') variantId: string) {
    await this.variantsService.activate(variantId);
    return { message: 'Variant activated' };
  }

  @Delete('variants/:variantId')
  async remove(@Param('variantId') variantId: string) {
    await this.variantsService.remove(variantId);
    return { message: 'Variant deleted' };
  }

  @Post('projects/migrate-to-variants')
  async migrateProjects() {
    const result = await this.variantsService.migrateExistingProjects();
    return { message: 'Migration complete', ...result };
  }

  @Get('variants/:variantId/preview')
  async preview(@Param('variantId') variantId: string, @Res() res: Response) {
    const variant = await this.variantsService.findById(variantId);
    const redirectPath = `/variant-preview/${variant.project.slug}--${variantId}/index.html`;
    res.redirect(redirectPath);
  }
}
