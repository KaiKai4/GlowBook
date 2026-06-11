import type { CookieOptions } from "@supabase/ssr";

interface WritableCookieStore {
  set(name: string, value: string, options: CookieOptions): void;
}

interface SupabaseCookie {
  name: string;
  value: string;
  options: CookieOptions;
}

const READ_ONLY_COOKIE_ERROR =
  "Cookies can only be modified in a Server Action or Route Handler";

export { SESSION_ONLY_COOKIE } from "./session-persistence";

export function sessionScopedOptions(
  options: CookieOptions,
  sessionOnly: boolean
): CookieOptions {
  if (!sessionOnly) return options;
  return { ...options, maxAge: undefined, expires: undefined };
}

export function setSupabaseServerCookies(
  cookieStore: WritableCookieStore,
  cookiesToSet: SupabaseCookie[],
  sessionOnly = false
) {
  try {
    cookiesToSet.forEach(({ name, value, options }) => {
      cookieStore.set(name, value, sessionScopedOptions(options, sessionOnly));
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes(READ_ONLY_COOKIE_ERROR)
    ) {
      return;
    }

    throw error;
  }
}
