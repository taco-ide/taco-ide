import { NextRequest, NextResponse } from "next/server";

// Auth routes (login, signup, etc.) - logged in users should be redirected away
const authPaths = ["/auth"];

// Auth routes that logged-in users must still reach. The accept-invitation
// page is opened from an email link by people who may already be signed in.
const authPathsForLoggedInUsers = ["/auth/accept-invitation"];

// Public paths that don't require authentication
const publicPaths = [
  "/", // Only the exact home page
];

// This function is executed for all requests
export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Get Better Auth session cookie
  const sessionToken = request.cookies.get("better-auth.session_token")?.value;
  const isLoggedIn = !!sessionToken;

  // Check if current path is an auth route (login, signup, etc.)
  const isAuthPath = authPaths.some((path) => pathname.startsWith(path));

  // Check if the current path is public (accessible by anyone)
  const isPublicPath =
    publicPaths.some(
      (path) =>
        (path !== "/" && pathname.startsWith(path)) ||
        (path === "/" && pathname === "/")
    ) || isAuthPath;

  // If user is logged in and trying to access auth routes, redirect to dashboard
  const isAllowedWhileLoggedIn = authPathsForLoggedInUsers.some((path) =>
    pathname.startsWith(path)
  );
  if (isLoggedIn && isAuthPath && !isAllowedWhileLoggedIn) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // If path is public, allow access
  if (isPublicPath) {
    return NextResponse.next();
  }

  // If no session token on protected route, redirect to login
  if (!sessionToken) {
    const url = new URL("/auth/login", request.url);
    // URLSearchParams encodes the value; encoding it again here would make
    // the login page see "%2F..." instead of a path.
    url.searchParams.set("redirect", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(url);
  }

  // User is logged in and accessing protected route
  return NextResponse.next();
}

// Route matching configuration for the middleware
export const config = {
  // Apply the middleware to all routes, except static resources
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*.svg|images/|public/|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.gif).*)",
  ],
};
