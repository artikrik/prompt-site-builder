import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
const base = 'C:/projects/prompt-site-builder_mimo2/apps/frontend/src/routes';

function fix(f, from, to) {
  let c = readFileSync(join(base, f), 'utf8');
  c = c.replace(from, to);
  writeFileSync(join(base, f), c);
  console.log('OK: ' + f);
}

fix('dashboard/leads/+page.svelte', '/* global console, window, alert, document */', '/* global console */');
fix('dashboard/projects/+page.svelte', '/* global console, window, alert, document */', '/* global alert, window */');
fix('dashboard/projects/[id]/+page.svelte', '/* global console, window, alert, document */', '/* global console, alert, window */');
fix('dashboard/settings/+page.svelte', '/* global console, window, alert, document */', '/* global console */');
console.log('Done');
