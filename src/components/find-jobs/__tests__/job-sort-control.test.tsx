import { describe, it, expect } from "vitest";
import { sortToApiParams } from "../job-sort-control";

describe("sortToApiParams", () => {
  it("maps 'newest' to firstSeenAt desc", () => {
    expect(sortToApiParams("newest")).toEqual({ sort: "firstSeenAt", order: "desc" });
  });

  it("maps 'oldest' to firstSeenAt asc", () => {
    expect(sortToApiParams("oldest")).toEqual({ sort: "firstSeenAt", order: "asc" });
  });

  it("maps 'title-asc' to title asc", () => {
    expect(sortToApiParams("title-asc")).toEqual({ sort: "title", order: "asc" });
  });

  it("maps 'title-desc' to title desc", () => {
    expect(sortToApiParams("title-desc")).toEqual({ sort: "title", order: "desc" });
  });

  it("maps 'salary' to salaryMax desc", () => {
    expect(sortToApiParams("salary")).toEqual({ sort: "salaryMax", order: "desc" });
  });
});
