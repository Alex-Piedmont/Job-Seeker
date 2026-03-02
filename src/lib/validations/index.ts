import { NextResponse } from "next/server";
import type { z } from "zod";

type ValidationSuccess<T> = { success: true; data: T };
type ValidationError = { success: false; response: NextResponse };

export async function validateBody<T>(
  request: Request,
  schema: z.ZodType<T>
): Promise<ValidationSuccess<T> | ValidationError> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return {
      success: false,
      response: NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      ),
    };
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    return {
      success: false,
      response: NextResponse.json(
        { error: result.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      ),
    };
  }

  return { success: true, data: result.data };
}
