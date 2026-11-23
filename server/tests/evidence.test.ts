import { describe, it, expect } from "vitest";
import { canonicalUrl, excerptInSource, stripInvalidCitations, citedLabels } from "../src/utils/evidence";

describe("canonicalUrl", () => {
  it("strips tracking params, hash, www and trailing slash", () => {
    expect(canonicalUrl("https://www.Example.com/a/?utm_source=x&id=2#top")).toBe("https://example.com/a?id=2");
  });
  it("rejects non-http schemes", () => {
    expect(canonicalUrl("javascript:alert(1)")).toBeNull();
    expect(canonicalUrl("file:///etc/passwd")).toBeNull();
  });
});

describe("excerptInSource", () => {
  const src = "Solar capacity grew by 24% in 2023, according to the agency.";
  it("accepts a real excerpt", () => expect(excerptInSource("grew by 24% in 2023", src)).toBe(true));
  it("rejects an invented excerpt", () => expect(excerptInSource("grew by 90% in 2023", src)).toBe(false));
});

describe("citations", () => {
  it("removes unknown source labels", () => {
    const out = stripInvalidCitations("A [S1] B [S9]", new Set(["S1"]));
    expect(out).toBe("A [S1] B ");
    expect(citedLabels(out)).toEqual(["S1"]);
  });
});
