import { NextResponse, type NextRequest } from "next/server";

// Public routes that don't require auth
const publicPaths = new Set<string>(["/login", "/LoginPage", "/api/login", "/api/session/status", "/api/logout", "/api/mock-login"]);

export function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;
    // Allow static files and public paths
    if (
        pathname.startsWith("/_next/") ||
        pathname.startsWith("/favicon") ||
        pathname.startsWith("/assets/") ||
        publicPaths.has(pathname)
    ) {
        return NextResponse.next();
    }

    const hasSession = Boolean(req.cookies.get("booking.session")?.value);
    if (!hasSession) {
        // API routes should return JSON error, not redirect to login page
        if (pathname.startsWith("/api/")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        
        const url = req.nextUrl.clone();
        url.pathname = "/login";
        url.searchParams.set("returnUrl", req.nextUrl.pathname + req.nextUrl.search);
        return NextResponse.redirect(url);
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        // Run on all routes except static assets
        "/((?!_next/static|_next/image|favicon.ico).*)",
    ],
};


