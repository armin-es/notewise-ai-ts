import { clerkMiddleware } from "@clerk/nextjs/server";

// Note: Next.js 16 deprecates middleware.ts in favor of "proxy" pattern,
// but Clerk still requires middleware.ts for authentication. This warning
// is expected until Clerk updates their package to support the new pattern.

export default clerkMiddleware();

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};

