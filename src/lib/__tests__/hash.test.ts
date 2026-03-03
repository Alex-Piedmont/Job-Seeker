import { describe, it, expect } from "vitest";
import { hashContent } from "../hash";

describe("hashContent", () => {
  it("returns a deterministic hash", () => {
    const hash1 = hashContent("hello world");
    const hash2 = hashContent("hello world");
    expect(hash1).toBe(hash2);
  });

  it("returns different hashes for different inputs", () => {
    const hash1 = hashContent("hello");
    const hash2 = hashContent("world");
    expect(hash1).not.toBe(hash2);
  });

  it("handles empty string", () => {
    const hash = hashContent("");
    expect(hash).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });

  it("returns a 64-character hex string", () => {
    const hash = hashContent("test");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});
