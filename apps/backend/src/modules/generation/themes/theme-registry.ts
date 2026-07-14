export interface HugoTheme {
  name: string;
  repoUrl: string;
  description: string;
  tags: string[];
  category: 'business' | 'portfolio' | 'blog' | 'minimal' | 'landing';
  previewUrl?: string;
}

export const HUGO_THEMES: HugoTheme[] = [
  {
    name: 'hugo-theme-zen',
    repoUrl: 'https://github.com/frjo/hugo-theme-zen',
    description: 'Clean, minimal theme suitable for any website',
    tags: ['minimal', 'responsive', 'accessible'],
    category: 'minimal',
  },
  {
    name: 'ananke',
    repoUrl: 'https://github.com/theNewDynamic/gohugo-theme-ananke',
    description: 'Modern, responsive theme perfect for business and professional sites',
    tags: ['responsive', 'modern', 'business', 'seo'],
    category: 'business',
  },
  {
    name: 'hugo-fresh',
    repoUrl: 'https://github.com/StefMa/hugo-fresh',
    description: 'Fresh, modern landing page theme — ideal for medical, cleaning, vet clinics',
    tags: ['landing', 'medical', 'clean', 'modern', 'responsive'],
    category: 'landing',
  },
  {
    name: 'hugo-hero-theme',
    repoUrl: 'https://github.com/zerostaticthemes/hugo-hero-theme',
    description: 'Hero-focused theme with bold visuals — perfect for salon, gym, fitness',
    tags: ['hero', 'salon', 'gym', 'fitness', 'visual'],
    category: 'landing',
  },
  {
    name: 'hugo-up-business',
    repoUrl: 'https://github.com/akshaybabloo/hugo-up-business',
    description: 'Professional business theme with landing page sections',
    tags: ['business', 'landing', 'corporate', 'responsive'],
    category: 'business',
  },
  {
    name: 'hugo-universal-theme',
    repoUrl: 'https://github.com/devcows/hugo-universal-theme',
    description: 'Universal business theme with multiple page layouts',
    tags: ['business', 'corporate', 'multipurpose', 'bootstrap'],
    category: 'business',
  },
  {
    name: 'hugo-scroll',
    repoUrl: 'https://github.com/janraasch/hugo-scroll',
    description: 'Single-page scroll theme — great for plumbers, logistics, trade services',
    tags: ['scroll', 'single-page', 'trades', 'logistics'],
    category: 'landing',
  },
  {
    name: 'corporio',
    repoUrl: 'https://github.com/mismirnyy/corporio',
    description: 'Clean corporate theme for business and agency sites',
    tags: ['corporate', 'business', 'agency', 'clean'],
    category: 'business',
  },
  {
    name: 'hugoplate',
    repoUrl: 'https://github.com/zeon-studio/hugoplate',
    description: 'Modern Hugo theme for SaaS and startup landing pages',
    tags: ['landing', 'saas', 'startup', 'tailwind'],
    category: 'landing',
  },
  {
    name: 'blowfish',
    repoUrl: 'https://github.com/nunocoracao/blowfish',
    description: 'Powerful, flexible theme built with Tailwind CSS',
    tags: ['tailwind', 'modern', 'flexible', 'dark-mode'],
    category: 'minimal',
  },
  {
    name: 'congo',
    repoUrl: 'https://github.com/jpanther/congo',
    description: 'Lightweight theme built with Tailwind CSS, great for business',
    tags: ['tailwind', 'lightweight', 'responsive', 'dark-mode'],
    category: 'minimal',
  },
  {
    name: 'hugo-theme-stack',
    repoUrl: 'https://github.com/CaiJimmy/hugo-theme-stack',
    description: 'Card-style theme, good for content-rich business sites',
    tags: ['cards', 'modern', 'content', 'responsive'],
    category: 'blog',
  },
  {
    name: 'PaperMod',
    repoUrl: 'https://github.com/adityatelange/hugo-PaperMod',
    description: 'Fast, clean theme with excellent SEO and performance',
    tags: ['fast', 'seo', 'clean', 'minimal'],
    category: 'blog',
  },
];

export function getThemesByCategory(category: HugoTheme['category']): HugoTheme[] {
  return HUGO_THEMES.filter((t) => t.category === category);
}

export function getThemeByName(name: string): HugoTheme | undefined {
  return HUGO_THEMES.find((t) => t.name === name);
}

export function getThemeNames(): string[] {
  return HUGO_THEMES.map((t) => t.name);
}
