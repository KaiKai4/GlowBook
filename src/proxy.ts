import { NextResponse, type NextRequest } from "next/server";
import { getOptimisticAuthDecision } from "./proxy-auth";

// Next.js 16 renamed Middleware to Proxy. Keep this check optimistic and cheap;
// full session validation and authorization live in layouts/use-cases.
export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const decision = getOptimisticAuthDecision({
    pathname,
    cookies: request.cookies.getAll(),
  });

  if (decision.type === "redirect") {
    return NextResponse.redirect(new URL(decision.location, request.url));
  }

  return NextResponse.next({ request });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
