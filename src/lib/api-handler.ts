import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

type AuthenticatedContext = {
  userId: string;
  params: Record<string, string>;
};

type HandlerFn = (
  request: Request,
  context: AuthenticatedContext
) => Promise<Response | NextResponse>;

/**
 * Wraps an API route handler with authentication and error handling.
 * Resolves Next.js 16 async params, checks auth, and catches errors.
 */
export function authenticatedHandler(handler: HandlerFn) {
  return async (
    request: Request,
    { params }: { params: Promise<Record<string, string>> }
  ): Promise<Response | NextResponse> => {
    try {
      const session = await auth();
      if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
