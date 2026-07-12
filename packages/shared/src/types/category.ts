export interface CategoryPrompt {
  id: string;
  category: string;
  contentPrompt: string;
  designPrompt: string;
  competitorPrompt: string;
  isCustom: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CategoryWithTheme {
  category: string;
  theme: string;
}

export const BUSINESS_CATEGORIES: CategoryWithTheme[] = [
  { category: 'Стоматологія', theme: 'hugo-fresh' },
  { category: 'Краса та догляд', theme: 'hugo-hero-theme' },
  { category: 'Юридичні послуги', theme: 'ananke' },
  { category: 'Будівництво', theme: 'hugo-universal-theme' },
  { category: 'Автосервіс', theme: 'hugo-universal-theme' },
  { category: 'Медицина', theme: 'hugo-fresh' },
  { category: 'Ветеринарія', theme: 'hugo-fresh' },
  { category: 'Ресторан/Кафе', theme: 'hugo-hero-theme' },
  { category: 'Фітнес/Спорт', theme: 'hugo-hero-theme' },
  { category: 'Логістика', theme: 'hugo-scroll' },
  { category: 'Консалтинг', theme: 'ananke' },
  { category: 'Нерухомість', theme: 'hugo-universal-theme' },
  { category: 'Ремонт/Оздоблення', theme: 'hugo-universal-theme' },
  { category: 'Сантехніка', theme: 'hugo-scroll' },
  { category: 'Клінінг', theme: 'hugo-fresh' },
  { category: 'ІТ/Розробка', theme: 'hugo-hero-theme' },
  { category: 'Інше', theme: 'auto' },
];

export const CATEGORY_LABELS: string[] = BUSINESS_CATEGORIES.map(c => c.category);

export interface ScrapeRequest {
  platforms: Array<'instagram' | 'facebook' | 'googleMaps'>;
}

export interface ScrapeResult {
  platform: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  photos?: string[];
  reviews?: Array<Record<string, unknown>>;
  contacts?: Record<string, unknown>;
  hours?: Record<string, unknown>;
  error?: string;
}

export interface UpdateCategoryPromptsDto {
  contentPrompt?: string;
  designPrompt?: string;
  competitorPrompt?: string;
}
