import { Controller, Get, Put, Post, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { SiteEditorService } from './site-editor.service';

@ApiTags('Site Editor')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/editor')
export class EditorController {
  constructor(private readonly editorService: SiteEditorService) {}

  @Get()
  @ApiOperation({ summary: 'Get editable sections of a site' })
  @ApiResponse({ status: 200, description: 'List of editable sections' })
  async getSections(@Param('projectId') projectId: string) {
    return this.editorService.getEditableSections(projectId);
  }

  @Put(':section')
  @ApiOperation({ summary: 'Update a site section' })
  @ApiResponse({ status: 200, description: 'Section updated' })
  async updateSection(
    @Param('projectId') projectId: string,
    @Param('section') section: string,
    @Body() data: Record<string, unknown>,
  ) {
    await this.editorService.updateSection(projectId, section, data);
    return { success: true, section };
  }

  @Post('regenerate')
  @ApiOperation({ summary: 'Regenerate site after edits' })
  @ApiResponse({ status: 200, description: 'Site regeneration started' })
  async regenerateSite(@Param('projectId') projectId: string) {
    await this.editorService.regenerateSite(projectId);
    return { success: true, message: 'Site regeneration started' };
  }
}
