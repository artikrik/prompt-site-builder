import { z as resolve_route, B as try_get_request_store, C as add_data_suffix, D as initial_base, E as base } from './index.js-C88fsYC1.js';

function resolve(id, params) {
  if (!id.startsWith("/")) {
    throw new Error(
      `Cannot use \`resolve(...)\` with a non-absolute pathname or route ID (got "${id}"). \`resolve\` is only for internal pathnames and route IDs; external URLs should be used directly.`
    );
  }
  const resolved = resolve_route(
    id,
    /** @type {Record<string, string>} */
    params
  );
  {
    const store = try_get_request_store();
    if (store && !store.state.prerendering?.fallback) {
      const pathname = store.event.isDataRequest ? add_data_suffix(store.event.url.pathname) : store.event.url.pathname;
      const after_base = pathname.slice(initial_base.length);
      const segments = after_base.split("/").slice(2);
      const prefix = segments.map(() => "..").join("/") || ".";
      return prefix + resolved;
    }
  }
  return base + resolved;
}

export { resolve as r };
//# sourceMappingURL=server-Bcj9tt-e.js.map
