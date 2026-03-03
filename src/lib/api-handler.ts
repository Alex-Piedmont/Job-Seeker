import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { checkRateLimit, rateLimitHeaders } from "@/lib/rate-limit";

type AuthenticatedContext = {
  userId: string;
  params: Record<string, string>;
};

type HandlerFn = (
  request: Request,
  context: AuthenticatedContext
) => Promise<Response | NextResponse>;

type HandlerOptions = {
  rateLimit?: "resume-generate" | "export" | "api-default";
};

/**
 * Wraps an API route handler with authentication, optional rate limiting, and error handling.
 * Resolves Next.js 16 async params, checks auth, and catches errors.
 */
export function authenticatedHandler(handler: HandlerFn, options?: HandlerOptions) {
  return async (
    request: Request,
    { params }: { params: Promise<Record<string, string>> }
  ): Promise<Response | NextResponse> => {
    try {
      const session = await auth();
      if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      // Rate limiting (skip for admins)
      if (options?.rateLimit && session.user.role !== "ADMIN") {
        const rlResult = await checkRateLimit(session.user.id, options.rateLimit);
        if (rlResult && !rlResult.allowed) {
          return NextResponse.json(
            { error: "Too many requests. Please try again later." },
            { status: 429, headers: rateLimitHeaders(rlResult) }
          );
        }
      }

      const resolvedParams = await params;

      return await handler(request, {
        userId: session.user.id,
        params: resolvedParams,
      });
    } catch (error) {
      console.error("API error:", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  };
}
