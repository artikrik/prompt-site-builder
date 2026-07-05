import { r as redirect } from './index.js-C88fsYC1.js';
import 'clsx';

const handle = async ({ event, resolve }) => {
  if (event.url.pathname.startsWith("/dashboard")) {
    const refreshToken = event.cookies.get("refresh_token");
    if (!refreshToken) {
      throw redirect(307, "/auth/login");
    }
  }
  return resolve(event);
};

export { handle };
//# sourceMappingURL=hooks.server-DT6FeTXc.js.map
