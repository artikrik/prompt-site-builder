import { i as head } from './index.js-C88fsYC1.js';
import './button-Chaq5D0i.js';
import 'clsx';
import './index-DWasNFG9.js';
import 'tailwind-merge';

function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      head("a30v8d", $$renderer3, ($$renderer4) => {
        $$renderer4.title(($$renderer5) => {
          $$renderer5.push(`<title>Settings - Prompt Site Builder</title>`);
        });
      });
      $$renderer3.push(`<div class="space-y-6"><h1 class="text-2xl font-bold tracking-tight">Settings</h1> `);
      {
        $$renderer3.push("<!--[0-->");
        $$renderer3.push(`<p class="text-muted-foreground">Loading settings...</p>`);
      }
      $$renderer3.push(`<!--]--></div>`);
    }
    do {
      $$settled = true;
      $$inner_renderer = $$renderer2.copy();
      $$render_inner($$inner_renderer);
    } while (!$$settled);
    $$renderer2.subsume($$inner_renderer);
  });
}

export { _page as default };
//# sourceMappingURL=_page.svelte-edezoiWM.js.map
