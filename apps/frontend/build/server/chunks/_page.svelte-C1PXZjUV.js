import { i as head, e as escape_html, f as store_get, b as ensure_array_like, c as attr, u as unsubscribe_stores, h as spread_props } from './index.js-C88fsYC1.js';
import './leads-yGJ56Jc6.js';
import { p as projects, B as Badge } from './badge-BtfkKnbG.js';
import { C as Card, a as Card_content } from './card-content-3ErZKb8d.js';
import 'clsx';
import { C as Card_header, a as Card_title } from './card-title-AGz2Qq50.js';
import { U as Users, F as Folder_open } from './users--H_ILrVE.js';
import { I as Icon } from './Icon-60d8THhb.js';
import './client2-DL3MN81r.js';
import './index-DWasNFG9.js';
import 'tailwind-merge';

function Circle_check_big($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    ["path", { "d": "M21.801 10A10 10 0 1 1 17 3.335" }],
    ["path", { "d": "m9 11 3 3L22 4" }]
  ];
  Icon($$renderer, spread_props([{ name: "circle-check-big" }, props, { iconNode }]));
}
function Triangle_alert($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    [
      "path",
      {
        "d": "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"
      }
    ],
    ["path", { "d": "M12 9v4" }],
    ["path", { "d": "M12 17h.01" }]
  ];
  Icon($$renderer, spread_props([{ name: "triangle-alert" }, props, { iconNode }]));
}
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let stats = {
      totalLeads: 0,
      newLeads: 0,
      activeProjects: 0,
      publishedSites: 0
    };
    head("x1i5gj", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>Dashboard - Prompt Site Builder</title>`);
      });
    });
    $$renderer2.push(`<!---->/* global console, window, alert, document */  <div class="space-y-6"><h1 class="text-2xl font-bold tracking-tight">Dashboard Overview</h1> <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">`);
    if (Card) {
      $$renderer2.push("<!--[-->");
      Card($$renderer2, {
        children: ($$renderer3) => {
          if (Card_header) {
            $$renderer3.push("<!--[-->");
            Card_header($$renderer3, {
              class: "flex flex-row items-center justify-between pb-2",
              children: ($$renderer4) => {
                if (Card_title) {
                  $$renderer4.push("<!--[-->");
                  Card_title($$renderer4, {
                    class: "text-sm font-medium text-muted-foreground",
                    children: ($$renderer5) => {
                      $$renderer5.push(`<!---->Total Leads`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer4.push("<!--]-->");
                } else {
                  $$renderer4.push("<!--[!-->");
                  $$renderer4.push("<!--]-->");
                }
                $$renderer4.push(` `);
                Users($$renderer4, { class: "w-4 h-4 text-muted-foreground" });
                $$renderer4.push(`<!---->`);
              },
              $$slots: { default: true }
            });
            $$renderer3.push("<!--]-->");
          } else {
            $$renderer3.push("<!--[!-->");
            $$renderer3.push("<!--]-->");
          }
          $$renderer3.push(` `);
          if (Card_content) {
            $$renderer3.push("<!--[-->");
            Card_content($$renderer3, {
              children: ($$renderer4) => {
                $$renderer4.push(`<div class="text-2xl font-bold">${escape_html(stats.totalLeads)}</div>`);
              },
              $$slots: { default: true }
            });
            $$renderer3.push("<!--]-->");
          } else {
            $$renderer3.push("<!--[!-->");
            $$renderer3.push("<!--]-->");
          }
        },
        $$slots: { default: true }
      });
      $$renderer2.push("<!--]-->");
    } else {
      $$renderer2.push("<!--[!-->");
      $$renderer2.push("<!--]-->");
    }
    $$renderer2.push(` `);
    if (Card) {
      $$renderer2.push("<!--[-->");
      Card($$renderer2, {
        children: ($$renderer3) => {
          if (Card_header) {
            $$renderer3.push("<!--[-->");
            Card_header($$renderer3, {
              class: "flex flex-row items-center justify-between pb-2",
              children: ($$renderer4) => {
                if (Card_title) {
                  $$renderer4.push("<!--[-->");
                  Card_title($$renderer4, {
                    class: "text-sm font-medium text-muted-foreground",
                    children: ($$renderer5) => {
                      $$renderer5.push(`<!---->New Leads`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer4.push("<!--]-->");
                } else {
                  $$renderer4.push("<!--[!-->");
                  $$renderer4.push("<!--]-->");
                }
                $$renderer4.push(` `);
                Triangle_alert($$renderer4, { class: "w-4 h-4 text-muted-foreground" });
                $$renderer4.push(`<!---->`);
              },
              $$slots: { default: true }
            });
            $$renderer3.push("<!--]-->");
          } else {
            $$renderer3.push("<!--[!-->");
            $$renderer3.push("<!--]-->");
          }
          $$renderer3.push(` `);
          if (Card_content) {
            $$renderer3.push("<!--[-->");
            Card_content($$renderer3, {
              children: ($$renderer4) => {
                $$renderer4.push(`<div class="text-2xl font-bold text-yellow-600">${escape_html(stats.newLeads)}</div>`);
              },
              $$slots: { default: true }
            });
            $$renderer3.push("<!--]-->");
          } else {
            $$renderer3.push("<!--[!-->");
            $$renderer3.push("<!--]-->");
          }
        },
        $$slots: { default: true }
      });
      $$renderer2.push("<!--]-->");
    } else {
      $$renderer2.push("<!--[!-->");
      $$renderer2.push("<!--]-->");
    }
    $$renderer2.push(` `);
    if (Card) {
      $$renderer2.push("<!--[-->");
      Card($$renderer2, {
        children: ($$renderer3) => {
          if (Card_header) {
            $$renderer3.push("<!--[-->");
            Card_header($$renderer3, {
              class: "flex flex-row items-center justify-between pb-2",
              children: ($$renderer4) => {
                if (Card_title) {
                  $$renderer4.push("<!--[-->");
                  Card_title($$renderer4, {
                    class: "text-sm font-medium text-muted-foreground",
                    children: ($$renderer5) => {
                      $$renderer5.push(`<!---->Active Projects`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer4.push("<!--]-->");
                } else {
                  $$renderer4.push("<!--[!-->");
                  $$renderer4.push("<!--]-->");
                }
                $$renderer4.push(` `);
                Folder_open($$renderer4, { class: "w-4 h-4 text-muted-foreground" });
                $$renderer4.push(`<!---->`);
              },
              $$slots: { default: true }
            });
            $$renderer3.push("<!--]-->");
          } else {
            $$renderer3.push("<!--[!-->");
            $$renderer3.push("<!--]-->");
          }
          $$renderer3.push(` `);
          if (Card_content) {
            $$renderer3.push("<!--[-->");
            Card_content($$renderer3, {
              children: ($$renderer4) => {
                $$renderer4.push(`<div class="text-2xl font-bold text-blue-600">${escape_html(stats.activeProjects)}</div>`);
              },
              $$slots: { default: true }
            });
            $$renderer3.push("<!--]-->");
          } else {
            $$renderer3.push("<!--[!-->");
            $$renderer3.push("<!--]-->");
          }
        },
        $$slots: { default: true }
      });
      $$renderer2.push("<!--]-->");
    } else {
      $$renderer2.push("<!--[!-->");
      $$renderer2.push("<!--]-->");
    }
    $$renderer2.push(` `);
    if (Card) {
      $$renderer2.push("<!--[-->");
      Card($$renderer2, {
        children: ($$renderer3) => {
          if (Card_header) {
            $$renderer3.push("<!--[-->");
            Card_header($$renderer3, {
              class: "flex flex-row items-center justify-between pb-2",
              children: ($$renderer4) => {
                if (Card_title) {
                  $$renderer4.push("<!--[-->");
                  Card_title($$renderer4, {
                    class: "text-sm font-medium text-muted-foreground",
                    children: ($$renderer5) => {
                      $$renderer5.push(`<!---->Published Sites`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer4.push("<!--]-->");
                } else {
                  $$renderer4.push("<!--[!-->");
                  $$renderer4.push("<!--]-->");
                }
                $$renderer4.push(` `);
                Circle_check_big($$renderer4, { class: "w-4 h-4 text-muted-foreground" });
                $$renderer4.push(`<!---->`);
              },
              $$slots: { default: true }
            });
            $$renderer3.push("<!--]-->");
          } else {
            $$renderer3.push("<!--[!-->");
            $$renderer3.push("<!--]-->");
          }
          $$renderer3.push(` `);
          if (Card_content) {
            $$renderer3.push("<!--[-->");
            Card_content($$renderer3, {
              children: ($$renderer4) => {
                $$renderer4.push(`<div class="text-2xl font-bold text-green-600">${escape_html(stats.publishedSites)}</div>`);
              },
              $$slots: { default: true }
            });
            $$renderer3.push("<!--]-->");
          } else {
            $$renderer3.push("<!--[!-->");
            $$renderer3.push("<!--]-->");
          }
        },
        $$slots: { default: true }
      });
      $$renderer2.push("<!--]-->");
    } else {
      $$renderer2.push("<!--[!-->");
      $$renderer2.push("<!--]-->");
    }
    $$renderer2.push(`</div> `);
    if (Card) {
      $$renderer2.push("<!--[-->");
      Card($$renderer2, {
        children: ($$renderer3) => {
          if (Card_header) {
            $$renderer3.push("<!--[-->");
            Card_header($$renderer3, {
              children: ($$renderer4) => {
                if (Card_title) {
                  $$renderer4.push("<!--[-->");
                  Card_title($$renderer4, {
                    children: ($$renderer5) => {
                      $$renderer5.push(`<!---->Recent Projects`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer4.push("<!--]-->");
                } else {
                  $$renderer4.push("<!--[!-->");
                  $$renderer4.push("<!--]-->");
                }
              },
              $$slots: { default: true }
            });
            $$renderer3.push("<!--]-->");
          } else {
            $$renderer3.push("<!--[!-->");
            $$renderer3.push("<!--]-->");
          }
          $$renderer3.push(` `);
          if (Card_content) {
            $$renderer3.push("<!--[-->");
            Card_content($$renderer3, {
              children: ($$renderer4) => {
                if (store_get($$store_subs ??= {}, "$projects", projects).projects.length === 0) {
                  $$renderer4.push("<!--[0-->");
                  $$renderer4.push(`<p class="text-muted-foreground text-center py-8">No projects yet. Create your first project from the Leads page.</p>`);
                } else {
                  $$renderer4.push("<!--[-1-->");
                  $$renderer4.push(`<div class="space-y-4"><!--[-->`);
                  const each_array = ensure_array_like(store_get($$store_subs ??= {}, "$projects", projects).projects.slice(0, 5));
                  for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
                    let project = each_array[$$index];
                    $$renderer4.push(`<div class="flex items-center justify-between p-4 border border-border rounded-lg"><div><p class="font-medium">${escape_html(project.lead?.businessName || project.slug)}</p> <p class="text-sm text-muted-foreground">${escape_html(project.slug)}.sitenow.pp.ua</p></div> <div class="flex items-center gap-3">`);
                    Badge($$renderer4, {
                      variant: project.status === "PUBLISHED" ? "default" : project.status === "GENERATING" ? "secondary" : "outline",
                      children: ($$renderer5) => {
                        $$renderer5.push(`<!---->${escape_html(project.status)}`);
                      },
                      $$slots: { default: true }
                    });
                    $$renderer4.push(`<!----> `);
                    if (project.publishedUrl) {
                      $$renderer4.push("<!--[0-->");
                      $$renderer4.push(`<a${attr("href", project.publishedUrl ?? "#")} target="_blank" rel="noopener noreferrer" class="text-sm text-primary underline">View Site</a>`);
                    } else {
                      $$renderer4.push("<!--[-1-->");
                    }
                    $$renderer4.push(`<!--]--></div></div>`);
                  }
                  $$renderer4.push(`<!--]--></div>`);
                }
                $$renderer4.push(`<!--]-->`);
              },
              $$slots: { default: true }
            });
            $$renderer3.push("<!--]-->");
          } else {
            $$renderer3.push("<!--[!-->");
            $$renderer3.push("<!--]-->");
          }
        },
        $$slots: { default: true }
      });
      $$renderer2.push("<!--]-->");
    } else {
      $$renderer2.push("<!--[!-->");
      $$renderer2.push("<!--]-->");
    }
    $$renderer2.push(`</div>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}

export { _page as default };
//# sourceMappingURL=_page.svelte-C1PXZjUV.js.map
