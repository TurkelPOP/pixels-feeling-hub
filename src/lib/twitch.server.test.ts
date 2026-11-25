import { beforeEach, describe, expect, it, vi } from "vitest";

const request = { url: "https://site.example/", ip: "1.2.3.4" };

vi.mock("@tanstack/react-start/server", () => ({
  getRequestUrl: () => new URL(request.url),
  getRequestIP: () => request.ip,
}));

import { isRateLimited, pinRedirectUri, resolveChannelLogin } from "./twitch.server";

const CALLBACK = "/auth/twitch/callback";

describe("pinRedirectUri", () => {
  beforeEach(() => {
    request.url = "https://site.example/";
    delete process.env.SITE_URL;
    delete process.env.VITE_SITE_URL;
  });

  it("accepts the callback on the request's own origin", () => {
    expect(pinRedirectUri(`https://site.example${CALLBACK}`)).toBe(
      `https://site.example${CALLBACK}`,
    );
  });

  it("rejects another origin, another path, query strings and credentials", () => {
    expect(pinRedirectUri(`https://evil.example${CALLBACK}`)).toBeUndefined();
    expect(pinRedirectUri("https://site.example/elsewhere")).toBeUndefined();
    expect(pinRedirectUri(`https://site.example${CALLBACK}?next=//evil.example`)).toBeUndefined();
    expect(pinRedirectUri(`https://user:pw@site.example${CALLBACK}`)).toBeUndefined();
    expect(pinRedirectUri("not a url")).toBeUndefined();
  });

  it("also accepts the configured SITE_URL origin", () => {
    process.env.SITE_URL = "https://prod.example/";
    expect(pinRedirectUri(`https://prod.example${CALLBACK}`)).toBe(
      `https://prod.example${CALLBACK}`,
    );
  });
});

describe("isRateLimited", () => {
  it("blocks after `max` hits in the window, per client", () => {
    request.ip = "9.9.9.9";
    expect([1, 2, 3].map(() => isRateLimited("t", 3, 60_000))).toEqual([false, false, false]);
    expect(isRateLimited("t", 3, 60_000)).toBe(true);
    request.ip = "8.8.8.8";
    expect(isRateLimited("t", 3, 60_000)).toBe(false);
  });
});

describe("resolveChannelLogin", () => {
  it("falls back to the default channel for invalid values", () => {
    process.env.TWITCH_CHANNEL = "Not Valid!";
    expect(resolveChannelLogin()).toBe("turkelpop");
    process.env.TWITCH_CHANNEL = " SomeChannel ";
    expect(resolveChannelLogin()).toBe("somechannel");
    delete process.env.TWITCH_CHANNEL;
  });
});
