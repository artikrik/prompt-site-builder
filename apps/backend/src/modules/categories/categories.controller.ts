import { Controller, Get, Put, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { CategoriesService } from './categories.service';
import { CategoryPrompt, CategoryWithTheme, UpdateCategoryPromptsDto } from '@prompt-site-builder/shared';

@ApiTags('Categories')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @ApiOperation({ summary: 'List all business categories with themes' })
  async list(): Promise<CategoryWithTheme[]> {
    return this.categoriesService.listCategories();
  }

  @Get(':category/prompts')
  @ApiOperation({ summary: 'Get prompts for a category' })
  async getPrompts(@Param('category') category: string): Promise<CategoryPrompt> {
    return this.categoriesService.getPrompts(category);
  }

  @Put(':category/prompts')
  @ApiOperation({ summary: 'Update prompts for a category' })
  async updatePrompts(
    @Param('category') category: string,
    @Body() dto: UpdateCategoryPromptsDto,
  ): Promise<CategoryPrompt> {
    return this.categoriesService.updatePrompts(category, dto);
  }
}
