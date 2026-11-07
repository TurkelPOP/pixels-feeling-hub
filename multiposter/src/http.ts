/** Erreur HTTP d'une API tierce, avec un message lisible extrait de la réponse. */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function extractMessage(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const b = body as Record<string, any>;
  return (
    b.error?.message ??
    b.error?.error_user_msg ??
    b.error_description ??
    (typeof b.error === "string" ? b.error : undefined) ??
    b.detail ??
    b.title ??
    b.errors?.[0]?.message ??
    b.message
  );
}

export async function request(url: string, init: RequestInit = {}, timeoutMs = 60_000): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (e) {
    const cause = (e as { cause?: { code?: string } }).cause?.code;
    const why = (e as Error).name === "TimeoutError" ? "délai dépassé" : (cause ?? (e as Error).message);
    throw new Error(`${new URL(url).host} injoignable (${why})`);
  }
  if (!res.ok) {
    const raw = await res.text();
    let msg: string | undefined;
    try {
      msg = extractMessage(JSON.parse(raw));
    } catch {
      msg = raw.slice(0, 300);
    }
    const host = new URL(url).host;
    throw new ApiError(`${host} HTTP ${res.status}${msg ? ` : ${msg}` : ""}`, res.status);
  }
  return res;
}

export async function json<T = any>(url: string, init: RequestInit = {}, timeoutMs?: number): Promise<T> {
  const res = await request(url, init, timeoutMs);
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  // TikTok renvoie HTTP 200 avec error.code != "ok".
  if (data?.error?.code && data.error.code !== "ok") {
    throw new ApiError(`${new URL(url).host} : ${data.error.message || data.error.code}`, res.status);
  }
  return data as T;
}

export const form = (data: Record<string, string>) => ({
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams(data),
});

export const postJson = (data: unknown, headers: Record<string, string> = {}) => ({
  method: "POST",
  headers: { "Content-Type": "application/json", ...headers },
  body: JSON.stringify(data),
});

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Attend qu'une condition asynchrone soit vraie (traitement vidéo côté réseau). */
export async function waitFor(
  check: () => Promise<boolean>,
  { intervalMs = 5_000, timeoutMs = 10 * 60_000, what = "traitement" } = {},
): Promise<void> {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (await check()) return;
    await sleep(intervalMs);
  }
  throw new Error(`Délai dépassé pendant le ${what}`);
}
