import { Controller, Get, Post, Put, Delete, Param, Body, Res, UseGuards, NotFoundException } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../../../shared/guards/jwt-auth.guard';
import { VariantsService } from './variants.service';
import { CreateVariantDto } from '@prompt-site-builder/shared';
import * as path from 'path';
import * as fs from 'fs';

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

  @Get('variants/:variantId/preview')
  async preview(@Param('variantId') variantId: string, @Res() res: Response) {
    const variant = await this.variantsService.findById(variantId);
    const hugoSitesPath = process.env.HUGO_SITES_PATH || '/var/www/client-sites';
    const variantDir = path.join(hugoSitesPath, `${variant.project.slug}--${variantId}`);
    const indexPath = path.join(variantDir, 'index.html');

    if (!fs.existsSync(indexPath)) {
      throw new NotFoundException('Variant preview not yet generated');
    }
    res.sendFile(indexPath);
  }
}
