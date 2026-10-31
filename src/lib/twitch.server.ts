// Server-only Twitch helpers shared by twitch.functions.ts and twitch-auth.functions.ts.
import { getRequestIP, getRequestUrl } from "@tanstack/react-start/server";

export const DEFAULT_CHANNEL = "turkelpop";
export const CALLBACK_PATH = "/auth/twitch/callback";

// Twitch logins: letters, digits and underscores, at most 25 chars.
const LOGIN_RE = /^[a-z0-9_]{3,25}$/;

export function resolveChannelLogin(): string {
  const configured = (process.env.TWITCH_CHANNEL || DEFAULT_CHANNEL).toLowerCase().trim();
  return LOGIN_RE.test(configured) ? configured : DEFAULT_CHANNEL;
}

/**
 * The OAuth redirect URI is never taken on trust from the client: it must be the
 * callback path on this site's own origin (the request's, or SITE_URL / VITE_SITE_URL).
 * Returns the normalised URI, or undefined if it is not allowed.
 */
export function pinRedirectUri(candidate: string): string | undefined {
  let uri: URL;
  try {
    uri = new URL(candidate);
  } catch {
    return undefined;
  }
  if (uri.pathname !== CALLBACK_PATH || uri.search || uri.hash || uri.username || uri.password) {
    return undefined;
  }

  const allowed = new Set<string>();
  allowed.add(getRequestUrl({ xForwardedHost: true, xForwardedProto: true }).origin);
  const configured = process.env.SITE_URL || process.env.VITE_SITE_URL;
  if (configured) {
    try {
      allowed.add(new URL(configured).origin);
    } catch {
      /* ignore a malformed SITE_URL */
    }
  }
  return allowed.has(uri.origin) ? uri.toString() : undefined;
}

const hits = new Map<string, number[]>();

/**
 * Small per-isolate sliding-window limiter for the login endpoints. It stops casual
 * abuse of the Twitch token exchange, it is not a distributed rate limiter.
 */
export function isRateLimited(bucket: string, max: number, windowMs: number): boolean {
  const ip = getRequestIP({ xForwardedFor: true }) ?? "unknown";
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5_000) {
    for (const [k, v] of hits) if (v.every((t) => now - t >= windowMs)) hits.delete(k);
  }
  return false;
}
