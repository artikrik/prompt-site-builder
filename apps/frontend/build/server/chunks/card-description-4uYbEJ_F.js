import { k as attributes, n as clsx, j as bind_props } from './index.js-C88fsYC1.js';
import { c as cn } from './index-DWasNFG9.js';

function Card_description($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      ref = null,
      class: className,
      children,
      $$slots,
      $$events,
      ...restProps
    } = $$props;
    $$renderer2.push(`<p${attributes({
      "data-slot": "card-description",
      class: clsx(cn("text-muted-foreground text-sm", className)),
      ...restProps
    })}>`);
    children?.($$renderer2);
    $$renderer2.push(`<!----></p>`);
    bind_props($$props, { ref });
  });
}

export { Card_description as C };
//# sourceMappingURL=card-description-4uYbEJ_F.js.map
