import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Check for Better Auth session token cookie
    const sessionCookie =
        request.cookies.get("better-auth.session_token")?.value ||
        request.cookies.get("__Secure-better-auth.session_token")?.value;

    const isAuthRoute =
        pathname.startsWith("/sign-in") || pathname.startsWith("/sign-up");

    const isProtectedRoute =
        pathname === "/" ||
        pathname.startsWith("/meetings") ||
        pathname.startsWith("/agents") ||
        pathname.startsWith("/call");

    // Redirect unauthenticated users to /sign-in
    if (isProtectedRoute && !sessionCookie) {
        const signInUrl = new URL("/sign-in", request.url);
        return NextResponse.redirect(signInUrl);
    }

    // Redirect authenticated users away from auth pages to home
    if (isAuthRoute && sessionCookie) {
        const homeUrl = new URL("/", request.url);
        return NextResponse.redirect(homeUrl);
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - api routes (handled individually)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico, sitemap.xml, robots.txt
         * - static assets (.svg, .png, etc.)
         */
        "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ],
};
