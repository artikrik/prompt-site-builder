export const BUSINESS_CATEGORIES: Array<{ category: string; theme: string }> = [
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

export type CategoryWithTheme = { category: string; theme: string };
