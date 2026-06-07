export type ProxyAuthDecision =
  | { type: "next" }
  | { type: "redirect"; location: "/login" | "/" };

export interface ProxyAuthInput {
  pathname: string;
  cookies: Array<{ name: string }>;
  hasVerifiedSession?: boolean;
}

export function hasSupabaseSessionCookie(
  cookies: Array<{ name: string }>
): boolean {
  return cookies.some(({ name }) => {
    if (!name.startsWith("sb-")) return false;
    return name.endsWith("-auth-token") || /-auth-token\.\d+$/.test(name);
  });
}

export function getOptimisticAuthDecision({
  pathname,
  cookies,
  hasVerifiedSession,
}: ProxyAuthInput): ProxyAuthDecision {
  const hasAuthCookie =
    hasVerifiedSession ?? hasSupabaseSessionCookie(cookies);
  const isLoginRoute = pathname.startsWith("/login");
  const isInvitationRoute = pathname.startsWith("/invite");
  const isJoinRoute = pathname.startsWith("/join");
  const isAuthRoute = isLoginRoute || isInvitationRoute || isJoinRoute;

  if (!hasAuthCookie && !isAuthRoute) {
    return { type: "redirect", location: "/login" };
  }

  if (hasAuthCookie && (isLoginRoute || isJoinRoute)) {
    return { type: "redirect", location: "/" };
  }

  return { type: "next" };
}
