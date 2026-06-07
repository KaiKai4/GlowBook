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

export function setSupabaseServerCookies(
  cookieStore: WritableCookieStore,
  cookiesToSet: SupabaseCookie[]
) {
  try {
    cookiesToSet.forEach(({ name, value, options }) => {
      cookieStore.set(name, value, options);
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
