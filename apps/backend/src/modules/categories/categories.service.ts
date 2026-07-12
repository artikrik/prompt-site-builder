import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CategoryPrompt, CategoryWithTheme, BUSINESS_CATEGORIES, UpdateCategoryPromptsDto } from '@prompt-site-builder/shared';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async listCategories(): Promise<CategoryWithTheme[]> {
    return BUSINESS_CATEGORIES;
  }

  async getPrompts(category: string): Promise<CategoryPrompt> {
    const prompts = await this.prisma.categoryPrompt.findUnique({
      where: { category },
    });

    if (!prompts) {
      throw new NotFoundException(`Category ${category} not found`);
    }

    return prompts;
  }

  async updatePrompts(category: string, dto: UpdateCategoryPromptsDto): Promise<CategoryPrompt> {
    const existing = await this.prisma.categoryPrompt.findUnique({
      where: { category },
    });

    if (!existing) {
      throw new NotFoundException(`Category ${category} not found`);
    }

    return this.prisma.categoryPrompt.update({
      where: { category },
      data: {
        ...dto,
        isCustom: true,
      },
    });
  }
}
