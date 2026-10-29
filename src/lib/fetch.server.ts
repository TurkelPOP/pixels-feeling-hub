/* eslint-disable prettier/prettier */
// Server-only helpers shared by the *.functions.ts handlers.

const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;

/** fetch() that aborts after `timeoutMs` so a slow upstream can't hang the worker. */
export function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
}

/** Reads a response body as text, refusing payloads larger than `maxBytes`. */
export async function readTextLimited(res: Response, maxBytes = DEFAULT_MAX_BYTES): Promise<string> {
  const declared = Number(res.headers.get("content-length"));
  if (declared > maxBytes) throw new Error("Upstream response too large");
  if (!res.body) return "";

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error("Upstream response too large");
    }
    chunks.push(value);
  }
  const buf = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    buf.set(c, offset);
    offset += c.byteLength;
  }
  return new TextDecoder().decode(buf);
}

/** Returns `raw` only if it is an absolute http(s) URL, otherwise "". */
export function safeHttpUrl(raw: string | undefined | null): string {
  if (!raw) return "";
  try {
    const url = new URL(raw.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : "";
  } catch {
    return "";
  }
}

type CacheEntry<T> = { value: T; expires: number };
const cache = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

/**
 * Memoizes `fn` per isolate for `ttlMs` and coalesces concurrent calls, so
 * public server functions don't hit upstream APIs (and burn their quotas)
 * on every page view. Failures are not cached.
 */
export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key) as CacheEntry<T> | undefined;
  if (hit && hit.expires > Date.now()) return hit.value;

  const pending = inflight.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  const p = fn()
    .then((value) => {
      cache.set(key, { value, expires: Date.now() + ttlMs });
      return value;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

export function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d{1,7});/g, (m, n: string) => {
      const cp = Number(n);
      return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : m;
    })
    .replace(/&amp;/g, "&");
}
