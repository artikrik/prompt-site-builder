import { redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
  // protected dashboard routes — server-side auth check
  if (event.url.pathname.startsWith('/dashboard')) {
    const refreshToken = event.cookies.get('refresh_token');

    if (!refreshToken) {
      throw redirect(307, '/auth/login');
    }

    // cookie exists but might be expired/invalid.
    // allow page load — API calls will return 401 if token is bad,
    // and the client-side api interceptor will redirect to login.
  }

  return resolve(event);
};
