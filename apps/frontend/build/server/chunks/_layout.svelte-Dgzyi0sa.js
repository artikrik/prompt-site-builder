import { b as ensure_array_like, c as attr, d as attr_class, f as store_get, e as escape_html, u as unsubscribe_stores, h as spread_props, g as getContext } from './index.js-C88fsYC1.js';
import { r as resolve } from './server-Bcj9tt-e.js';
import 'clsx';
import './state.svelte-DVqRVRs-.js';
import { g as goto } from './client-BV-POYKX.js';
import { a as auth } from './auth-CH0VhKJ5.js';
import { B as Button } from './button-Chaq5D0i.js';
import { I as Icon } from './Icon-60d8THhb.js';
import { U as Users, F as Folder_open } from './users--H_ILrVE.js';
import './client2-DL3MN81r.js';
import './index-DWasNFG9.js';
import 'tailwind-merge';

function House($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    [
      "path",
      { "d": "M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" }
    ],
    [
      "path",
      {
        "d": "M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
      }
    ]
  ];
  Icon($$renderer, spread_props([{ name: "house" }, props, { iconNode }]));
}
function Log_out($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    ["path", { "d": "m16 17 5-5-5-5" }],
    ["path", { "d": "M21 12H9" }],
    ["path", { "d": "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" }]
  ];
  Icon($$renderer, spread_props([{ name: "log-out" }, props, { iconNode }]));
}
function Settings($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    [
      "path",
      {
        "d": "M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"
      }
    ],
    ["circle", { "cx": "12", "cy": "12", "r": "3" }]
  ];
  Icon($$renderer, spread_props([{ name: "settings" }, props, { iconNode }]));
}
const getStores = () => {
  const stores$1 = getContext("__svelte__");
  return {
    /** @type {typeof page} */
    page: {
      subscribe: stores$1.page.subscribe
    },
    /** @type {typeof navigating} */
    navigating: {
      subscribe: stores$1.navigating.subscribe
    },
    /** @type {typeof updated} */
    updated: stores$1.updated
  };
};
const page = {
  subscribe(fn) {
    const store = getStores().page;
    return store.subscribe(fn);
  }
};
function _layout($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let { children } = $$props;
    const navItems = [
      { href: "/dashboard", label: "Overview", icon: House },
      { href: "/dashboard/leads", label: "Leads", icon: Users },
      {
        href: "/dashboard/projects",
        label: "Projects",
        icon: Folder_open
      },
      {
        href: "/dashboard/settings",
        label: "Settings",
        icon: Settings
      }
    ];
    function isActive(href, pathname) {
      if (href === "/dashboard") return pathname === "/dashboard";
      return pathname.startsWith(href);
    }
    $$renderer2.push(`<div class="min-h-screen bg-background flex"><aside class="w-64 border-r border-border flex flex-col"><div class="h-14 flex items-center px-4 border-b border-border"><h1 class="text-lg font-semibold">Prompt Site Builder</h1></div> <nav class="flex-1 p-3 space-y-1"><!--[-->`);
    const each_array = ensure_array_like(navItems);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let item = each_array[$$index];
      const Icon2 = item.icon;
      $$renderer2.push(`<a${attr("href", resolve(item.href))}${attr_class(`flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors ${isActive(item.href, store_get($$store_subs ??= {}, "$page", page).url.pathname) ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"}`)}>`);
      if (Icon2) {
        $$renderer2.push("<!--[-->");
        Icon2($$renderer2, { class: "w-4 h-4" });
        $$renderer2.push("<!--]-->");
      } else {
        $$renderer2.push("<!--[!-->");
        $$renderer2.push("<!--]-->");
      }
      $$renderer2.push(` ${escape_html(item.label)}</a>`);
    }
    $$renderer2.push(`<!--]--></nav> <div class="p-3 border-t border-border">`);
    Button($$renderer2, {
      variant: "ghost",
      class: "w-full justify-start gap-3",
      onclick: () => {
        auth.logout();
        goto(resolve("/auth/login"));
      },
      children: ($$renderer3) => {
        Log_out($$renderer3, { class: "w-4 h-4" });
        $$renderer3.push(`<!----> Logout`);
      },
      $$slots: { default: true }
    });
    $$renderer2.push(`<!----></div></aside> <main class="flex-1 overflow-auto"><div class="p-6">`);
    children($$renderer2);
    $$renderer2.push(`<!----></div></main></div>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}

export { _layout as default };
//# sourceMappingURL=_layout.svelte-Dgzyi0sa.js.map
