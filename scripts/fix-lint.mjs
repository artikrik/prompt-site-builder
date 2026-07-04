import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const base = 'C:/projects/prompt-site-builder_mimo2/apps/frontend/src/routes';

function fix(filePath, replacements) {
  let content = readFileSync(join(base, filePath), 'utf8');
  for (const [from, to] of replacements) {
    content = content.replace(from, to);
  }
  writeFileSync(join(base, filePath), content);
  console.log('OK: ' + filePath);
}

// Move global comments inside script tags
const globalFiles = [
  'dashboard/leads/+page.svelte',
  'dashboard/projects/+page.svelte',
  'dashboard/projects/[id]/+page.svelte',
  'dashboard/settings/+page.svelte',
  'dashboard/+page.svelte'
];
const globalRegex = /\/\* global console, window, alert, document \*\/\s*<script lang="ts">/;
const globalReplace = '<script lang="ts">\n  /* global console, window, alert, document */';
globalFiles.forEach(f => fix(f, [[globalRegex, globalReplace]]));

// dashboard/+layout.svelte
fix('dashboard/+layout.svelte', [
  [/import \* as Separator from '\$lib\/components\/ui\/separator\/index\.js';\n/, ''],
  ["import { goto } from '$app/navigation';", "import { goto } from '$app/navigation';\n  import { resolve } from '$app/paths';"],
  [/goto\('/auth\/login'\)/g, "goto(resolve('/auth/login'))"],
  [/\{#each navItems as item\}/, '{#each navItems as item (item.href)}'],
  [/href=\{item\.href\}/, 'href={resolve(item.href)}']
]);

// auth/login/+page.svelte
fix('auth/login/+page.svelte', [
  ["import { goto } from '$app/navigation';", "import { goto } from '$app/navigation';\n  import { resolve } from '$app/paths';"],
  [/goto\('\/dashboard'\)/, "goto(resolve('/dashboard'))"],
  [/href="\/auth\/login"/, "href={resolve('/auth/login')}"]
]);

// root +page.svelte
fix('+page.svelte', [
  [/goto\('\/auth\/login'\)/g, "goto(resolve('/auth/login'))"],
  [/goto\('\/dashboard'\)/g, "goto(resolve('/dashboard'))"]
]);

// dashboard/+page.svelte - add resolve import
fix('dashboard/+page.svelte', [
  ["import { onMount } from 'svelte';", "import { onMount } from 'svelte';\n  import { resolve } from '$app/paths';"]
]);

console.log('All fixes applied.');
