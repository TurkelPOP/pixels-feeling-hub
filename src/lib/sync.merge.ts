// Données synchronisées entre appareils et leur fusion. Pur, sans import serveur ni navigateur,
// pour être partagé par le client, le serveur et les tests.
import { z } from "zod";

export const MAX_ENTRIES = 1000;
/** Une date plus lointaine que ça dans le futur est une horloge fausse : on la ramène à « maintenant ». */
const MAX_FUTURE_SKEW_MS = 5 * 60_000;

export const RATES = [0.75, 1, 1.25, 1.5, 2] as const;

const positionEntry = z.object({
  /** Secondes écoutées ; 0 = position effacée (l'épisode a été terminé). */
  s: z.number().min(0).max(1_000_000),
  /** Dernière modification, en millisecondes. */
  t: z.number().int().min(0),
});

const historyItem = z.object({
  id: z.string().min(1).max(200),
  type: z.enum(["podcast", "youtube", "twitch"]),
  status: z.enum(["started", "completed"]),
  progress: z.number().min(0).max(100).optional(),
  updatedAt: z.string().max(40),
});

const rateEntry = z.object({
  v: z.number().refine((n) => (RATES as readonly number[]).includes(n)),
  t: z.number().int().min(0),
});

const key = z.string().min(1).max(200);

export const syncPayloadSchema = z.object({
  positions: z.record(key, positionEntry).refine((r) => Object.keys(r).length <= MAX_ENTRIES * 2),
  history: z.record(key, historyItem).refine((r) => Object.keys(r).length <= MAX_ENTRIES * 2),
  rate: rateEntry.optional(),
});

export type PositionEntry = z.infer<typeof positionEntry>;
export type HistoryItem = z.infer<typeof historyItem>;
export type RateEntry = z.infer<typeof rateEntry>;
export type SyncPayload = z.infer<typeof syncPayloadSchema>;

export const emptyPayload = (): SyncPayload => ({ positions: {}, history: {} });

function keepValid<T>(raw: unknown, schema: z.ZodType<T>): Record<string, T> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, T> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const parsed = schema.safeParse(v);
    if (k.length > 0 && k.length <= 200 && parsed.success) out[k] = parsed.data;
  }
  return out;
}

/**
 * Nettoie des données locales (localStorage, potentiellement d'anciennes versions ou modifiées à la main)
 * en écartant les entrées invalides une par une : une seule entrée abîmée ne doit pas bloquer toute la synchro.
 */
export function sanitizePayload(raw: unknown): SyncPayload {
  const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const rate = rateEntry.safeParse(source.rate);
  return {
    positions: keepNewest(keepValid(source.positions, positionEntry), (p) => p.t, MAX_ENTRIES),
    history: keepNewest(keepValid(source.history, historyItem), (h) => timeOf(h.updatedAt), MAX_ENTRIES),
    ...(rate.success ? { rate: rate.data } : {}),
  };
}

const timeOf = (iso: string): number => {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
};

function keepNewest<T>(record: Record<string, T>, stamp: (v: T) => number, max: number): Record<string, T> {
  const entries = Object.entries(record);
  if (entries.length <= max) return record;
  return Object.fromEntries(entries.sort((a, b) => stamp(b[1]) - stamp(a[1])).slice(0, max));
}

/** Le plus récent gagne ; à égalité on garde la valeur locale (a). */
function newerPosition(a: PositionEntry | undefined, b: PositionEntry | undefined): PositionEntry | undefined {
  if (!a) return b;
  if (!b) return a;
  return b.t > a.t ? b : a;
}

/** « Terminé » est définitif : un autre appareil qui n'a fait que démarrer l'épisode ne le fait pas redevenir « en cours ». */
function mergeHistoryItem(a: HistoryItem | undefined, b: HistoryItem | undefined): HistoryItem | undefined {
  if (!a) return b;
  if (!b) return a;
  if (a.status === "completed" && b.status !== "completed") return a;
  if (b.status === "completed" && a.status !== "completed") return b;
  return timeOf(b.updatedAt) > timeOf(a.updatedAt) ? b : a;
}

export function mergeSync(a: SyncPayload, b: SyncPayload): SyncPayload {
  const positions: Record<string, PositionEntry> = { ...a.positions };
  for (const [guid, entry] of Object.entries(b.positions)) {
    const merged = newerPosition(positions[guid], entry);
    if (merged) positions[guid] = merged;
  }

  const history: Record<string, HistoryItem> = { ...a.history };
  for (const [id, item] of Object.entries(b.history)) {
    const merged = mergeHistoryItem(history[id], item);
    if (merged) history[id] = merged;
  }

  const rate = !a.rate ? b.rate : !b.rate ? a.rate : b.rate.t > a.rate.t ? b.rate : a.rate;

  return {
    positions: keepNewest(positions, (p) => p.t, MAX_ENTRIES),
    history: keepNewest(history, (h) => timeOf(h.updatedAt), MAX_ENTRIES),
    ...(rate ? { rate } : {}),
  };
}

/** Ramène les horodatages futurs à `now` : une horloge déréglée ne doit pas figer une valeur pour toujours. */
export function clampFuture(payload: SyncPayload, now = Date.now()): SyncPayload {
  const limit = now + MAX_FUTURE_SKEW_MS;
  const positions = Object.fromEntries(
    Object.entries(payload.positions).map(([k, v]) => [k, v.t > limit ? { ...v, t: now } : v]),
  );
  const history = Object.fromEntries(
    Object.entries(payload.history).map(([k, v]) => [
      k,
      timeOf(v.updatedAt) > limit ? { ...v, updatedAt: new Date(now).toISOString() } : v,
    ]),
  );
  const rate = payload.rate && payload.rate.t > limit ? { ...payload.rate, t: now } : payload.rate;
  return { positions, history, ...(rate ? { rate } : {}) };
}

/** Deux états identiques : sert à ne pas renvoyer au serveur ce qu'il vient de nous donner. */
export function samePayload(a: SyncPayload, b: SyncPayload): boolean {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

function canonical(p: SyncPayload) {
  const sorted = <T>(r: Record<string, T>) => Object.fromEntries(Object.entries(r).sort(([x], [y]) => x.localeCompare(y)));
  return { positions: sorted(p.positions), history: sorted(p.history), rate: p.rate ?? null };
}
