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

    // Validate session cookie presence AND expiry (format: empCode|expiresAtMs|sig)
    const cookieValue = req.cookies.get("booking.session")?.value;
    const validSession = (() => {
        if (!cookieValue) return false;
        const parts = cookieValue.split("|");
        if (parts.length !== 3) return false;
        const expMs = Number(parts[1]);
        if (!Number.isFinite(expMs)) return false;
        return Date.now() < expMs; // treat expired as no session
    })();

    if (!validSession) {
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


