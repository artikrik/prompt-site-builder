import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { WidgetsService } from './widgets.service';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { UserRole } from '@prompt-site-builder/shared';
import { CreateWidgetDto, ClientWidget } from '@prompt-site-builder/shared';

@ApiTags('Widgets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('widgets')
export class WidgetsController {
  constructor(private readonly widgetsService: WidgetsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a widget for a project' })
  @ApiResponse({ status: 201, description: 'Widget created' })
  async create(@Body() dto: CreateWidgetDto): Promise<ClientWidget> {
    return this.widgetsService.create(dto);
  }

  @Get('project/:projectId')
  @ApiOperation({ summary: 'Get all widgets for a project' })
  @ApiResponse({ status: 200, description: 'List of widgets' })
  async findByProject(@Param('projectId') projectId: string): Promise<ClientWidget[]> {
    return this.widgetsService.findByProject(projectId);
  }

  @Put(':id/toggle')
  @ApiOperation({ summary: 'Toggle widget enabled state' })
  @ApiResponse({ status: 200, description: 'Widget updated' })
  async toggle(
    @Param('id') id: string,
    @Body('enabled') enabled: boolean,
  ): Promise<ClientWidget> {
    return this.widgetsService.toggleEnabled(id, enabled);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a widget' })
  @ApiResponse({ status: 204, description: 'Widget deleted' })
  async remove(@Param('id') id: string): Promise<void> {
    return this.widgetsService.remove(id);
  }

  @Get('html/:projectId')
  @ApiOperation({ summary: 'Get widget HTML for a project' })
  @ApiResponse({ status: 200, description: 'Widget HTML' })
  async getHtml(@Param('projectId') projectId: string): Promise<{ html: string }> {
    const html = await this.widgetsService.getWidgetHtml(projectId);
    return { html };
  }
}
