import { i as head, h as spread_props } from './index.js-C88fsYC1.js';
import { g as goto } from './client-BV-POYKX.js';
import { r as resolve } from './server-Bcj9tt-e.js';
import './badge-BtfkKnbG.js';
import { B as Button } from './button-Chaq5D0i.js';
import 'clsx';
import { I as Icon } from './Icon-60d8THhb.js';
import './state.svelte-DVqRVRs-.js';
import './client2-DL3MN81r.js';
import './index-DWasNFG9.js';
import 'tailwind-merge';

function Arrow_left($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    ["path", { "d": "m12 19-7-7 7-7" }],
    ["path", { "d": "M19 12H5" }]
  ];
  Icon($$renderer, spread_props([{ name: "arrow-left" }, props, { iconNode }]));
}
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      head("1jm36eo", $$renderer3, ($$renderer4) => {
        $$renderer4.title(($$renderer5) => {
          $$renderer5.push(`<title>Project Details - Prompt Site Builder</title>`);
        });
      });
      $$renderer3.push(`<div class="space-y-6"><div>`);
      Button($$renderer3, {
        variant: "ghost",
        size: "sm",
        onclick: () => goto(resolve("/dashboard/projects")),
        class: "mb-4",
        children: ($$renderer4) => {
          Arrow_left($$renderer4, { class: "w-4 h-4 mr-2" });
          $$renderer4.push(`<!----> Back to Projects`);
        },
        $$slots: { default: true }
      });
      $$renderer3.push(`<!----></div> `);
      {
        $$renderer3.push("<!--[0-->");
        $$renderer3.push(`<div class="text-center py-12 text-muted-foreground">Loading...</div>`);
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
//# sourceMappingURL=_page.svelte-CnaqUT-6.js.map
