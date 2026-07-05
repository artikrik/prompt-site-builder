import { G as element, k as attributes, n as clsx, j as bind_props, w as writable } from './index.js-C88fsYC1.js';
import { a as api } from './client2-DL3MN81r.js';
import { t as tv, c as cn } from './index-DWasNFG9.js';

function createProjectsStore() {
  const { subscribe, update } = writable({
    projects: [],
    isLoading: false,
    error: null
  });
  return {
    subscribe,
    async fetchAll() {
      update((s) => ({ ...s, isLoading: true, error: null }));
      try {
        const projects2 = await api.get("/projects");
        update((s) => ({ ...s, projects: projects2, isLoading: false }));
      } catch (error) {
        update((s) => ({ ...s, isLoading: false, error: error instanceof Error ? error.message : "Failed to fetch projects" }));
      }
    },
    async fetchOne(id) {
      const project = await api.get(`/projects/${id}`);
      return project;
    },
    async create(leadId) {
      const project = await api.post("/projects", { leadId });
      update((s) => ({ ...s, projects: [project, ...s.projects] }));
      return project;
    },
    async generate(projectId, theme) {
      await api.post(`/generation/${projectId}/generate`, { theme: theme || "auto" });
      update((s) => ({
        ...s,
        projects: s.projects.map(
          (p) => p.id === projectId ? { ...p, status: "GENERATING" } : p
        )
      }));
    },
    async remove(id) {
      await api.delete(`/projects/${id}`);
      update((s) => ({ ...s, projects: s.projects.filter((p) => p.id !== id) }));
    }
  };
}
const projects = createProjectsStore();
const badgeVariants = tv({
  base: "h-5 gap-1 rounded-4xl border border-transparent px-2 py-0.5 text-xs font-medium transition-all has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&>svg]:size-3! focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive group/badge inline-flex w-fit shrink-0 items-center justify-center overflow-hidden whitespace-nowrap transition-colors focus-visible:ring-[3px] [&>svg]:pointer-events-none",
  variants: {
    variant: {
      default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
      secondary: "bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
      destructive: "bg-destructive/10 [a]:hover:bg-destructive/20 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 text-destructive dark:bg-destructive/20",
      outline: "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
      ghost: "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
      link: "text-primary underline-offset-4 hover:underline"
    }
  },
  defaultVariants: { variant: "default" }
});
function Badge($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      ref = null,
      href,
      class: className,
      variant = "default",
      children,
      $$slots,
      $$events,
      ...restProps
    } = $$props;
    element(
      $$renderer2,
      href ? "a" : "span",
      () => {
        $$renderer2.push(`${attributes({
          "data-slot": "badge",
          href,
          class: clsx(cn(badgeVariants({ variant }), className)),
          ...restProps
        })}`);
      },
      () => {
        children?.($$renderer2);
        $$renderer2.push(`<!---->`);
      }
    );
    bind_props($$props, { ref });
  });
}

export { Badge as B, projects as p };
//# sourceMappingURL=badge-BtfkKnbG.js.map
