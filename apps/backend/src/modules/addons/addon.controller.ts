import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { AddonService } from './addon.service';
import type { AddonType, Prisma } from '@prisma/client';

@Controller()
@UseGuards(JwtAuthGuard)
export class AddonController {
  constructor(private readonly addonService: AddonService) {}

  @Get('projects/:id/addons')
  async list(@Param('id') projectId: string) {
    return this.addonService.listByProject(projectId);
  }

  @Post('projects/:id/addons')
  async activate(
    @Param('id') projectId: string,
    @Body() dto: { addonType: AddonType; config?: Prisma.InputJsonValue },
  ) {
    return this.addonService.activate(projectId, dto.addonType, dto.config || {});
  }

  @Put('projects/:id/addons/:addonType')
  async updateConfig(
    @Param('id') projectId: string,
    @Param('addonType') addonType: AddonType,
    @Body() config: Prisma.InputJsonValue,
  ) {
    return this.addonService.updateConfig(projectId, addonType, config);
  }

  @Delete('projects/:id/addons/:addonType')
  async deactivate(
    @Param('id') projectId: string,
    @Param('addonType') addonType: AddonType,
  ) {
    return this.addonService.deactivate(projectId, addonType);
  }
}
