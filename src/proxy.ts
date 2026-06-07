import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getOptimisticAuthDecision } from "./proxy-auth";

export async function proxy(request: NextRequest) {
  const initialDecision = getOptimisticAuthDecision({
    pathname: request.nextUrl.pathname,
    cookies: request.cookies.getAll(),
  });

  if (
    initialDecision.type === "redirect" &&
    initialDecision.location === "/login"
  ) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  let supabaseResponse = NextResponse.next({ request });
  const authHeaders: Record<string, string> = {};

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          Object.assign(authHeaders, headers);
          supabaseResponse = NextResponse.next({ request });

          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
          Object.entries(authHeaders).forEach(([key, value]) => {
            supabaseResponse.headers.set(key, value);
          });
        },
      },
    }
  );

  await supabase.auth.getClaims();

  const pathname = request.nextUrl.pathname;
  const decision = getOptimisticAuthDecision({
    pathname,
    cookies: request.cookies.getAll(),
  });

  if (decision.type === "redirect") {
    const redirectResponse = NextResponse.redirect(
      new URL(decision.location, request.url)
    );
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie);
    });
    Object.entries(authHeaders).forEach(([key, value]) => {
      redirectResponse.headers.set(key, value);
    });
    return redirectResponse;
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
