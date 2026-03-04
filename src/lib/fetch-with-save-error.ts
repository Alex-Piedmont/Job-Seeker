import { SaveError } from "./save-error";

export async function fetchOrThrowSaveError(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(input, init);
  } catch {
    throw new SaveError("Network error. Check your connection.", 0);
  }

  if (!res.ok) {
    let message = "Something went wrong. Please try again.";
    try {
      const body = await res.json();
      if (body.error && typeof body.error === "string") {
        message = body.error;
      }
    } catch {
      // ignore parse failure
    }
    throw new SaveError(message, res.status);
  }

  return res;
}
