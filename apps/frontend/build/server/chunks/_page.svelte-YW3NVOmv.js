import { i as head, c as attr, e as escape_html } from './index.js-C88fsYC1.js';
import { r as resolve } from './server-Bcj9tt-e.js';
import './state.svelte-DVqRVRs-.js';
import './auth-CH0VhKJ5.js';
import { B as Button } from './button-Chaq5D0i.js';
import { C as Card, a as Card_content } from './card-content-3ErZKb8d.js';
import { C as Card_description } from './card-description-4uYbEJ_F.js';
import 'clsx';
import { C as Card_header, a as Card_title } from './card-title-AGz2Qq50.js';
import { L as Label, I as Input } from './label-T6gIAfIN.js';
import './client2-DL3MN81r.js';
import './index-DWasNFG9.js';
import 'tailwind-merge';
import './create-id-DYnOyWbz.js';

function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let name = "";
    let email = "";
    let password = "";
    let isLoading = false;
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      head("8bdjn9", $$renderer3, ($$renderer4) => {
        $$renderer4.title(($$renderer5) => {
          $$renderer5.push(`<title>Register - Prompt Site Builder</title>`);
        });
      });
      $$renderer3.push(`<div class="min-h-screen flex items-center justify-center bg-background px-4">`);
      if (Card) {
        $$renderer3.push("<!--[-->");
        Card($$renderer3, {
          class: "w-full max-w-md",
          children: ($$renderer4) => {
            if (Card_header) {
              $$renderer4.push("<!--[-->");
              Card_header($$renderer4, {
                class: "text-center",
                children: ($$renderer5) => {
                  if (Card_title) {
                    $$renderer5.push("<!--[-->");
                    Card_title($$renderer5, {
                      class: "text-2xl",
                      children: ($$renderer6) => {
                        $$renderer6.push(`<!---->Create your account`);
                      },
                      $$slots: { default: true }
                    });
                    $$renderer5.push("<!--]-->");
                  } else {
                    $$renderer5.push("<!--[!-->");
                    $$renderer5.push("<!--]-->");
                  }
                  $$renderer5.push(` `);
                  if (Card_description) {
                    $$renderer5.push("<!--[-->");
                    Card_description($$renderer5, {
                      children: ($$renderer6) => {
                        $$renderer6.push(`<!---->Or <a${attr("href", resolve("/auth/login"))} class="text-primary underline underline-offset-4">sign in to existing account</a>`);
                      },
                      $$slots: { default: true }
                    });
                    $$renderer5.push("<!--]-->");
                  } else {
                    $$renderer5.push("<!--[!-->");
                    $$renderer5.push("<!--]-->");
                  }
                },
                $$slots: { default: true }
              });
              $$renderer4.push("<!--]-->");
            } else {
              $$renderer4.push("<!--[!-->");
              $$renderer4.push("<!--]-->");
            }
            $$renderer4.push(` `);
            if (Card_content) {
              $$renderer4.push("<!--[-->");
              Card_content($$renderer4, {
                children: ($$renderer5) => {
                  $$renderer5.push(`<form class="space-y-4">`);
                  {
                    $$renderer5.push("<!--[-1-->");
                  }
                  $$renderer5.push(`<!--]--> <div class="space-y-2">`);
                  Label($$renderer5, {
                    for: "name",
                    children: ($$renderer6) => {
                      $$renderer6.push(`<!---->Full name`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer5.push(`<!----> `);
                  Input($$renderer5, {
                    id: "name",
                    type: "text",
                    required: true,
                    get value() {
                      return name;
                    },
                    set value($$value) {
                      name = $$value;
                      $$settled = false;
                    }
                  });
                  $$renderer5.push(`<!----></div> <div class="space-y-2">`);
                  Label($$renderer5, {
                    for: "email",
                    children: ($$renderer6) => {
                      $$renderer6.push(`<!---->Email address`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer5.push(`<!----> `);
                  Input($$renderer5, {
                    id: "email",
                    type: "email",
                    required: true,
                    get value() {
                      return email;
                    },
                    set value($$value) {
                      email = $$value;
                      $$settled = false;
                    }
                  });
                  $$renderer5.push(`<!----></div> <div class="space-y-2">`);
                  Label($$renderer5, {
                    for: "password",
                    children: ($$renderer6) => {
                      $$renderer6.push(`<!---->Password`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer5.push(`<!----> `);
                  Input($$renderer5, {
                    id: "password",
                    type: "password",
                    required: true,
                    get value() {
                      return password;
                    },
                    set value($$value) {
                      password = $$value;
                      $$settled = false;
                    }
                  });
                  $$renderer5.push(`<!----></div> `);
                  Button($$renderer5, {
                    type: "submit",
                    class: "w-full",
                    disabled: isLoading,
                    children: ($$renderer6) => {
                      $$renderer6.push(`<!---->${escape_html("Create account")}`);
                    },
                    $$slots: { default: true }
                  });
                  $$renderer5.push(`<!----></form>`);
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
      $$renderer3.push(`</div>`);
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
//# sourceMappingURL=_page.svelte-YW3NVOmv.js.map
