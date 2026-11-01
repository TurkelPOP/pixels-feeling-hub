import { describe, expect, it, vi } from "vitest";

import { cached, decodeEntities, safeHttpUrl } from "./fetch.server";

describe("safeHttpUrl", () => {
  it("keeps absolute http(s) URLs only", () => {
    expect(safeHttpUrl("https://example.com/a")).toBe("https://example.com/a");
    expect(safeHttpUrl("javascript:alert(1)")).toBe("");
    expect(safeHttpUrl("//example.com")).toBe("");
    expect(safeHttpUrl(undefined)).toBe("");
  });
});

describe("decodeEntities", () => {
  it("decodes named and numeric entities, ampersand last", () => {
    expect(decodeEntities("a &amp;lt; b &#233; &quot;c&quot;")).toBe('a &lt; b é "c"');
  });
});

describe("cached", () => {
  it("memoizes within the TTL and coalesces concurrent calls", async () => {
    const fn = vi.fn(async () => "v1");
    const [a, b] = await Promise.all([cached("k1", 1000, fn), cached("k1", 1000, fn)]);
    expect([a, b]).toEqual(["v1", "v1"]);
    await cached("k1", 1000, fn);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("serves the last good value when a refresh fails, and does not cache failures", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await cached("k2", 0, async () => "good");
    expect(await cached("k2", 0, async () => Promise.reject(new Error("boom")))).toBe("good");
    await expect(cached("k3", 0, async () => Promise.reject(new Error("boom")))).rejects.toThrow(
      "boom",
    );
    expect(await cached("k3", 0, async () => "recovered")).toBe("recovered");
  });
});
