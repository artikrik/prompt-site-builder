import { i as head, j as bind_props, h as spread_props, p as props_id, k as attributes, l as derived } from './index.js-C88fsYC1.js';
import { r as resolve } from './server-Bcj9tt-e.js';
import { g as goto } from './client-BV-POYKX.js';
import { B as Button } from './button-Chaq5D0i.js';
import { C as Card, a as Card_content } from './card-content-3ErZKb8d.js';
import { C as Card_description } from './card-description-4uYbEJ_F.js';
import 'clsx';
import { C as Card_header, a as Card_title } from './card-title-AGz2Qq50.js';
import { c as cn } from './index-DWasNFG9.js';
import { c as createId, b as boxWith, a as attachRef, d as boolToStrTrueOrUndef, m as mergeProps, e as createBitsAttrs } from './create-id-DYnOyWbz.js';
import { S as Search } from './search-DKEhBrv8.js';
import { I as Icon } from './Icon-60d8THhb.js';
import './state.svelte-DVqRVRs-.js';
import 'tailwind-merge';

const separatorAttrs = createBitsAttrs({ component: "separator", parts: ["root"] });
class SeparatorRootState {
  static create(opts) {
    return new SeparatorRootState(opts);
  }
  opts;
  attachment;
  constructor(opts) {
    this.opts = opts;
    this.attachment = attachRef(opts.ref);
  }
  #props = derived(() => ({
    id: this.opts.id.current,
    role: this.opts.decorative.current ? "none" : "separator",
    "aria-orientation": this.opts.orientation.current,
    "aria-hidden": boolToStrTrueOrUndef(this.opts.decorative.current),
    "data-orientation": this.opts.orientation.current,
    [separatorAttrs.root]: "",
    ...this.attachment
  }));
  get props() {
    return this.#props();
  }
  set props($$value) {
    return this.#props($$value);
  }
}
function Separator$1($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const uid = props_id($$renderer2);
    let {
      id = createId(uid),
      ref = null,
      child,
      children,
      decorative = false,
      orientation = "horizontal",
      $$slots,
      $$events,
      ...restProps
    } = $$props;
    const rootState = SeparatorRootState.create({
      ref: boxWith(() => ref, (v) => ref = v),
      id: boxWith(() => id),
      decorative: boxWith(() => decorative),
      orientation: boxWith(() => orientation)
    });
    const mergedProps = derived(() => mergeProps(restProps, rootState.props));
    if (child) {
      $$renderer2.push("<!--[0-->");
      child($$renderer2, { props: mergedProps() });
      $$renderer2.push(`<!---->`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<div${attributes({ ...mergedProps() })}>`);
      children?.($$renderer2);
      $$renderer2.push(`<!----></div>`);
    }
    $$renderer2.push(`<!--]-->`);
    bind_props($$props, { ref });
  });
}
function Separator($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      ref = null,
      class: className,
      "data-slot": dataSlot = "separator",
      $$slots,
      $$events,
      ...restProps
    } = $$props;
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      if (Separator$1) {
        $$renderer3.push("<!--[-->");
        Separator$1($$renderer3, spread_props([
          {
            "data-slot": dataSlot,
            class: cn("bg-border shrink-0 data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:w-px", "data-[orientation=vertical]:h-full", className)
          },
          restProps,
          {
            get ref() {
              return ref;
            },
            set ref($$value) {
              ref = $$value;
              $$settled = false;
            }
          }
        ]));
        $$renderer3.push("<!--]-->");
      } else {
        $$renderer3.push("<!--[!-->");
        $$renderer3.push("<!--]-->");
      }
    }
    do {
      $$settled = true;
      $$inner_renderer = $$renderer2.copy();
      $$render_inner($$inner_renderer);
    } while (!$$settled);
    $$renderer2.subsume($$inner_renderer);
    bind_props($$props, { ref });
  });
}
function Globe($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    ["circle", { "cx": "12", "cy": "12", "r": "10" }],
    [
      "path",
      { "d": "M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" }
    ],
    ["path", { "d": "M2 12h20" }]
  ];
  Icon($$renderer, spread_props([{ name: "globe" }, props, { iconNode }]));
}
function Zap($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    [
      "path",
      {
        "d": "M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"
      }
    ]
  ];
  Icon($$renderer, spread_props([{ name: "zap" }, props, { iconNode }]));
}
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    head("1uha8ag", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>Prompt Site Builder - AI-Powered B2B Site Generation</title>`);
      });
      $$renderer3.push(`<meta name="description" content="Automated platform for generating SEO-optimized websites for B2B businesses"/>`);
    });
    $$renderer2.push(`<div class="min-h-screen flex flex-col"><header class="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50"><div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"><div class="flex justify-between items-center h-16"><div class="flex items-center"><h1 class="text-xl font-bold">Prompt Site Builder</h1></div> <div class="flex items-center space-x-4">`);
    Button($$renderer2, {
      variant: "ghost",
      onclick: () => goto(resolve("/auth/login")),
      children: ($$renderer3) => {
        $$renderer3.push(`<!---->Login`);
      },
      $$slots: { default: true }
    });
    $$renderer2.push(`<!----> `);
    Button($$renderer2, {
      onclick: () => goto(resolve("/auth/login")),
      children: ($$renderer3) => {
        $$renderer3.push(`<!---->Get Started`);
      },
      $$slots: { default: true }
    });
    $$renderer2.push(`<!----></div></div></div></header> <main class="flex-1"><div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20"><div class="text-center space-y-6"><h2 class="text-4xl font-bold tracking-tight">AI-Powered B2B Website Generation</h2> <p class="text-xl text-muted-foreground max-w-3xl mx-auto">Automatically discover businesses without online presence and generate
          SEO-optimized websites with booking and payment integrations.</p> <div class="flex justify-center space-x-4">`);
    Button($$renderer2, {
      size: "lg",
      onclick: () => goto(resolve("/dashboard")),
      children: ($$renderer3) => {
        $$renderer3.push(`<!---->Open Dashboard`);
      },
      $$slots: { default: true }
    });
    $$renderer2.push(`<!----> `);
    Button($$renderer2, {
      size: "lg",
      variant: "outline",
      children: ($$renderer3) => {
        $$renderer3.push(`<!---->Learn More`);
      },
      $$slots: { default: true }
    });
    $$renderer2.push(`<!----></div></div> `);
    Separator($$renderer2, { class: "my-20" });
    $$renderer2.push(`<!----> <div class="grid grid-cols-1 md:grid-cols-3 gap-6">`);
    Card($$renderer2, {
      children: ($$renderer3) => {
        Card_header($$renderer3, {
          children: ($$renderer4) => {
            $$renderer4.push(`<div class="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-2">`);
            Search($$renderer4, { class: "w-6 h-6 text-primary" });
            $$renderer4.push(`<!----></div> `);
            Card_title($$renderer4, {
              children: ($$renderer5) => {
                $$renderer5.push(`<!---->Lead Discovery`);
              },
              $$slots: { default: true }
            });
            $$renderer4.push(`<!---->`);
          },
          $$slots: { default: true }
        });
        $$renderer3.push(`<!----> `);
        Card_content($$renderer3, {
          children: ($$renderer4) => {
            Card_description($$renderer4, {
              children: ($$renderer5) => {
                $$renderer5.push(`<!---->Find businesses without websites using Google Maps and social media scraping.`);
              },
              $$slots: { default: true }
            });
          },
          $$slots: { default: true }
        });
        $$renderer3.push(`<!---->`);
      },
      $$slots: { default: true }
    });
    $$renderer2.push(`<!----> `);
    Card($$renderer2, {
      children: ($$renderer3) => {
        Card_header($$renderer3, {
          children: ($$renderer4) => {
            $$renderer4.push(`<div class="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-2">`);
            Zap($$renderer4, { class: "w-6 h-6 text-primary" });
            $$renderer4.push(`<!----></div> `);
            Card_title($$renderer4, {
              children: ($$renderer5) => {
                $$renderer5.push(`<!---->AI Generation`);
              },
              $$slots: { default: true }
            });
            $$renderer4.push(`<!---->`);
          },
          $$slots: { default: true }
        });
        $$renderer3.push(`<!----> `);
        Card_content($$renderer3, {
          children: ($$renderer4) => {
            Card_description($$renderer4, {
              children: ($$renderer5) => {
                $$renderer5.push(`<!---->Generate complete Hugo websites with SEO content and custom images using AI.`);
              },
              $$slots: { default: true }
            });
          },
          $$slots: { default: true }
        });
        $$renderer3.push(`<!---->`);
      },
      $$slots: { default: true }
    });
    $$renderer2.push(`<!----> `);
    Card($$renderer2, {
      children: ($$renderer3) => {
        Card_header($$renderer3, {
          children: ($$renderer4) => {
            $$renderer4.push(`<div class="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-2">`);
            Globe($$renderer4, { class: "w-6 h-6 text-primary" });
            $$renderer4.push(`<!----></div> `);
            Card_title($$renderer4, {
              children: ($$renderer5) => {
                $$renderer5.push(`<!---->One-Click Publish`);
              },
              $$slots: { default: true }
            });
            $$renderer4.push(`<!---->`);
          },
          $$slots: { default: true }
        });
        $$renderer3.push(`<!----> `);
        Card_content($$renderer3, {
          children: ($$renderer4) => {
            Card_description($$renderer4, {
              children: ($$renderer5) => {
                $$renderer5.push(`<!---->Deploy to custom subdomains with automatic SSL and booking/payment widgets.`);
              },
              $$slots: { default: true }
            });
          },
          $$slots: { default: true }
        });
        $$renderer3.push(`<!---->`);
      },
      $$slots: { default: true }
    });
    $$renderer2.push(`<!----></div></div></main> <footer class="border-t border-border py-8"><div class="max-w-7xl mx-auto px-4 text-center text-muted-foreground text-sm"><p>© 2024 Prompt Site Builder. All rights reserved.</p></div></footer></div>`);
  });
}

export { _page as default };
//# sourceMappingURL=_page.svelte-2vtc8aJs.js.map
