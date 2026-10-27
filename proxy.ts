import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";

/**
 * When running against real Jira data, everything except the sign-in page and the auth endpoints
 * requires a valid Atlassian session. In mock mode Auth.js is never invoked (it would need
 * AUTH_SECRET), so the demo deployment keeps working with no auth configuration.
 */
const guarded = auth((req) => {
  const { pathname, search } = req.nextUrl;
  if (pathname === "/signin" || pathname.startsWith("/api/auth")) return NextResponse.next();
  if (req.auth && !req.auth.error) return NextResponse.next();

  if (pathname.startsWith("/api/")) return Response.json({ error: "Not signed in." }, { status: 401 });
  const to = new URL("/signin", req.nextUrl.origin);
  to.searchParams.set("callbackUrl", `${pathname}${search}`);
  return NextResponse.redirect(to);
});

export default function proxy(req: NextRequest, ctx: Parameters<typeof guarded>[1]) {
  if (process.env.NEXT_PUBLIC_DATA_SOURCE !== "jira") return NextResponse.next();
  return guarded(req, ctx);
}

export const config = {
  // These are fetched before anyone is signed in (the sign-in page logo, the tab icon), so they must skip the sign-in check.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|brand/|samples/).*)"],
};
