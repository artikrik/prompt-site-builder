import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
const base = 'C:/projects/prompt-site-builder_mimo2/apps/frontend/src';

function fix(filePath, replacements) {
  let c = readFileSync(join(base, filePath), 'utf8');
  for (const [from, to] of replacements) c = c.replace(from, to);
  writeFileSync(join(base, filePath), c);
  console.log('OK: ' + filePath);
}

// 1. Fix stores - remove unused 'set'
fix('lib/stores/leads.ts', [["const { subscribe, set, update }", "const { subscribe, update }"]]);
fix('lib/stores/projects.ts', [["const { subscribe, set, update }", "const { subscribe, update }"]]);

// 2. Fix utils.spec.ts - false && issue
fix('lib/utils.spec.ts', [["false && 'hidden',", ""]]);

// 3. Move global comments inside script tag for files that still have them outside
const globFiles = [
  'routes/dashboard/leads/+page.svelte',
  'routes/dashboard/projects/+page.svelte',
  'routes/dashboard/projects/[id]/+page.svelte',
  'routes/dashboard/settings/+page.svelte',
];
globFiles.forEach(f => {
  fix(f, [
    [/\/\* global console, window, alert, document \*\/\s*<script/, '<script'],
    ["<script lang=\"ts\">", "<script lang=\"ts\">\n  /* global console, window, alert, document */"]
  ]);
});

// 4. Fix layout.svelte - remove unused globals
fix('routes/dashboard/+layout.svelte', [
  ["  /* global console, window, alert, document */\n", ""]
]);

console.log('Done');
