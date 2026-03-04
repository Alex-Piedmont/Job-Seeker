import { describe, it, expect } from "vitest";
import { SaveError } from "../save-error";

describe("SaveError", () => {
  it("extends Error with name and status", () => {
    const err = new SaveError("bad request", 400);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("SaveError");
    expect(err.message).toBe("bad request");
    expect(err.status).toBe(400);
  });

  it("isRetryable for 500", () => {
    expect(new SaveError("", 500).isRetryable).toBe(true);
  });

  it("isRetryable for 502", () => {
    expect(new SaveError("", 502).isRetryable).toBe(true);
  });

  it("isRetryable for 503", () => {
    expect(new SaveError("", 503).isRetryable).toBe(true);
  });

  it("isRetryable for 0 (network error)", () => {
    expect(new SaveError("", 0).isRetryable).toBe(true);
  });

  it("not retryable for 400", () => {
    expect(new SaveError("", 400).isRetryable).toBe(false);
  });

  it("not retryable for 404", () => {
    expect(new SaveError("", 404).isRetryable).toBe(false);
  });

  it("not retryable for 422", () => {
    expect(new SaveError("", 422).isRetryable).toBe(false);
  });
});
