import { i as head, f as store_get, u as unsubscribe_stores, b as ensure_array_like, e as escape_html, h as spread_props } from './index.js-C88fsYC1.js';
import { p as projects, B as Badge } from './badge-BtfkKnbG.js';
import { g as goto } from './client-BV-POYKX.js';
import { r as resolve } from './server-Bcj9tt-e.js';
import { B as Button } from './button-Chaq5D0i.js';
import { C as Card, a as Card_content } from './card-content-3ErZKb8d.js';
import 'clsx';
import { T as Table, a as Table_header, c as Table_body, b as Table_row, d as Table_head, e as Table_cell } from './table-row-C6d5XoBP.js';
import { I as Icon } from './Icon-60d8THhb.js';
import './client2-DL3MN81r.js';
import './index-DWasNFG9.js';
import 'tailwind-merge';
import './state.svelte-DVqRVRs-.js';

function External_link($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    ["path", { "d": "M15 3h6v6" }],
    ["path", { "d": "M10 14 21 3" }],
    [
      "path",
      {
        "d": "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"
      }
    ]
  ];
  Icon($$renderer, spread_props([{ name: "external-link" }, props, { iconNode }]));
}
function Eye($$renderer, $$props) {
  let { $$slots, $$events, ...props } = $$props;
  const iconNode = [
    [
      "path",
      {
        "d": "M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"
      }
    ],
    ["circle", { "cx": "12", "cy": "12", "r": "3" }]
  ];
  Icon($$renderer, spread_props([{ name: "eye" }, props, { iconNode }]));
}
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    function getStatusVariant(status) {
      switch (status) {
        case "PUBLISHED":
          return "default";
        case "GENERATING":
          return "secondary";
        case "FAILED":
          return "destructive";
        default:
          return "outline";
      }
    }
    async function handleGenerate(projectId) {
      try {
        await projects.generate(projectId);
      } catch {
        alert("Failed to start generation");
      }
    }
    head("2a3fbc", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>Projects - Prompt Site Builder</title>`);
      });
    });
    $$renderer2.push(`<div class="space-y-6"><h1 class="text-2xl font-bold tracking-tight">Projects</h1> `);
    Card($$renderer2, {
      children: ($$renderer3) => {
        Card_content($$renderer3, {
          class: "pt-6",
          children: ($$renderer4) => {
            if (store_get($$store_subs ??= {}, "$projects", projects).isLoading) {
              $$renderer4.push("<!--[0-->");
              $$renderer4.push(`<div class="text-center py-12 text-muted-foreground">Loading...</div>`);
            } else if (store_get($$store_subs ??= {}, "$projects", projects).projects.length === 0) {
              $$renderer4.push("<!--[1-->");
              $$renderer4.push(`<div class="text-center py-12 text-muted-foreground">No projects yet. Go to Leads to create your first project.</div>`);
            } else {
              $$renderer4.push("<!--[-1-->");
              Table($$renderer4, {
                children: ($$renderer5) => {
                  Table_header($$renderer5, {
                    children: ($$renderer6) => {
                      Table_row($$renderer6, {
                        children: ($$renderer7) => {
                          Table_head($$renderer7, {
                            children: ($$renderer8) => {
                              $$renderer8.push(`<!---->Project`);
                            },
                            $$slots: { default: true }
                          });
                          $$renderer7.push(`<!----> `);
                          Table_head($$renderer7, {
                            children: ($$renderer8) => {
                              $$renderer8.push(`<!---->Domain`);
                            },
                            $$slots: { default: true }
                          });
                          $$renderer7.push(`<!----> `);
                          Table_head($$renderer7, {
                            children: ($$renderer8) => {
                              $$renderer8.push(`<!---->Status`);
                            },
                            $$slots: { default: true }
                          });
                          $$renderer7.push(`<!----> `);
                          Table_head($$renderer7, {
                            children: ($$renderer8) => {
                              $$renderer8.push(`<!---->Created`);
                            },
                            $$slots: { default: true }
                          });
                          $$renderer7.push(`<!----> `);
                          Table_head($$renderer7, {
                            class: "text-right",
                            children: ($$renderer8) => {
                              $$renderer8.push(`<!---->Actions`);
                            },
                            $$slots: { default: true }
                          });
                          $$renderer7.push(`<!---->`);
                        },
                        $$slots: { default: true }
                      });
                    },
                    $$slots: { default: true }
                  });
                  $$renderer5.push(`<!----> `);
                  Table_body($$renderer5, {
                    children: ($$renderer6) => {
                      $$renderer6.push(`<!--[-->`);
                      const each_array = ensure_array_like(store_get($$store_subs ??= {}, "$projects", projects).projects);
                      for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
                        let project = each_array[$$index];
                        Table_row($$renderer6, {
                          children: ($$renderer7) => {
                            Table_cell($$renderer7, {
                              children: ($$renderer8) => {
                                $$renderer8.push(`<div class="font-medium">${escape_html(project.lead?.businessName || project.slug)}</div> <div class="text-sm text-muted-foreground">${escape_html(project.lead?.category || "N/A")}</div>`);
                              },
                              $$slots: { default: true }
                            });
                            $$renderer7.push(`<!----> `);
                            Table_cell($$renderer7, {
                              class: "text-sm",
                              children: ($$renderer8) => {
                                $$renderer8.push(`<!---->${escape_html(project.slug)}.sitenow.pp.ua`);
                              },
                              $$slots: { default: true }
                            });
                            $$renderer7.push(`<!----> `);
                            Table_cell($$renderer7, {
                              children: ($$renderer8) => {
                                Badge($$renderer8, {
                                  variant: getStatusVariant(project.status),
                                  children: ($$renderer9) => {
                                    $$renderer9.push(`<!---->${escape_html(project.status)}`);
                                  },
                                  $$slots: { default: true }
                                });
                              },
                              $$slots: { default: true }
                            });
                            $$renderer7.push(`<!----> `);
                            Table_cell($$renderer7, {
                              class: "text-sm",
                              children: ($$renderer8) => {
                                $$renderer8.push(`<!---->${escape_html(new Date(project.createdAt).toLocaleDateString())}`);
                              },
                              $$slots: { default: true }
                            });
                            $$renderer7.push(`<!----> `);
                            Table_cell($$renderer7, {
                              class: "text-right space-x-2",
                              children: ($$renderer8) => {
                                if (project.status === "DRAFT") {
                                  $$renderer8.push("<!--[0-->");
                                  Button($$renderer8, {
                                    variant: "ghost",
                                    size: "sm",
                                    onclick: () => handleGenerate(project.id),
                                    children: ($$renderer9) => {
                                      $$renderer9.push(`<!---->Generate`);
                                    },
                                    $$slots: { default: true }
                                  });
                                } else {
                                  $$renderer8.push("<!--[-1-->");
                                }
                                $$renderer8.push(`<!--]--> `);
                                if (project.status === "PUBLISHED" && project.publishedUrl) {
                                  $$renderer8.push("<!--[0-->");
                                  Button($$renderer8, {
                                    variant: "ghost",
                                    size: "sm",
                                    onclick: () => window.open(project.publishedUrl, "_blank"),
                                    children: ($$renderer9) => {
                                      External_link($$renderer9, { class: "size-4 mr-1" });
                                      $$renderer9.push(`<!----> View Site`);
                                    },
                                    $$slots: { default: true }
                                  });
                                } else {
                                  $$renderer8.push("<!--[-1-->");
                                }
                                $$renderer8.push(`<!--]--> `);
                                Button($$renderer8, {
                                  variant: "ghost",
                                  size: "sm",
                                  onclick: () => goto(resolve(`/dashboard/projects/${project.id}`)),
                                  children: ($$renderer9) => {
                                    Eye($$renderer9, { class: "size-4" });
                                  },
                                  $$slots: { default: true }
                                });
                                $$renderer8.push(`<!---->`);
                              },
                              $$slots: { default: true }
                            });
                            $$renderer7.push(`<!---->`);
                          },
                          $$slots: { default: true }
                        });
                      }
                      $$renderer6.push(`<!--]-->`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer5.push(`<!---->`);
                },
                $$slots: { default: true }
              });
            }
            $$renderer4.push(`<!--]-->`);
          },
          $$slots: { default: true }
        });
      },
      $$slots: { default: true }
    });
    $$renderer2.push(`<!----></div>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}

export { _page as default };
//# sourceMappingURL=_page.svelte-D9HWGUhf.js.map
