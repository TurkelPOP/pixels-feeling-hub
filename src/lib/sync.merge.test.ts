import { describe, expect, it } from "vitest";

import {
  clampFuture,
  emptyPayload,
  mergeSync,
  samePayload,
  sanitizePayload,
  syncPayloadSchema,
  type HistoryItem,
  type SyncPayload,
} from "./sync.merge";

const item = (id: string, status: HistoryItem["status"], updatedAt: string): HistoryItem => ({
  id,
  type: "podcast",
  status,
  updatedAt,
});

const payload = (p: Partial<SyncPayload>): SyncPayload => ({ ...emptyPayload(), ...p });

describe("mergeSync", () => {
  it("garde la position la plus récente d'un épisode", () => {
    const local = payload({ positions: { ep: { s: 100, t: 2000 } } });
    const remote = payload({ positions: { ep: { s: 40, t: 1000 } } });
    expect(mergeSync(local, remote).positions.ep).toEqual({ s: 100, t: 2000 });
    expect(mergeSync(remote, local).positions.ep).toEqual({ s: 100, t: 2000 });
  });

  it("réunit les épisodes écoutés sur des appareils différents", () => {
    const merged = mergeSync(
      payload({ positions: { a: { s: 50, t: 1 } } }),
      payload({ positions: { b: { s: 70, t: 2 } } }),
    );
    expect(Object.keys(merged.positions).sort()).toEqual(["a", "b"]);
  });

  it("propage l'effacement d'une position (position à 0 plus récente)", () => {
    const merged = mergeSync(
      payload({ positions: { ep: { s: 0, t: 5000 } } }),
      payload({ positions: { ep: { s: 900, t: 4000 } } }),
    );
    expect(merged.positions.ep.s).toBe(0);
  });

  it("garde « terminé » même si l'autre appareil a une date plus récente en « démarré »", () => {
    const done = item("ep", "completed", "2026-11-01T10:00:00Z");
    const started = item("ep", "started", "2026-11-02T10:00:00Z");
    expect(mergeSync(payload({ history: { ep: done } }), payload({ history: { ep: started } })).history.ep.status).toBe("completed");
    expect(mergeSync(payload({ history: { ep: started } }), payload({ history: { ep: done } })).history.ep.status).toBe("completed");
  });

  it("prend l'entrée d'historique la plus récente à statut égal", () => {
    const older = item("ep", "started", "2026-11-01T10:00:00Z");
    const newer = { ...item("ep", "started", "2026-11-02T10:00:00Z"), progress: 60 };
    expect(mergeSync(payload({ history: { ep: older } }), payload({ history: { ep: newer } })).history.ep.progress).toBe(60);
  });

  it("choisit la vitesse la plus récente", () => {
    expect(mergeSync(payload({ rate: { v: 1.5, t: 10 } }), payload({ rate: { v: 2, t: 20 } })).rate).toEqual({ v: 2, t: 20 });
    expect(mergeSync(payload({}), payload({ rate: { v: 2, t: 20 } })).rate).toEqual({ v: 2, t: 20 });
  });

  it("est idempotent et commutatif sur le résultat", () => {
    const a = payload({ positions: { x: { s: 20, t: 5 } }, history: { x: item("x", "started", "2026-11-01T00:00:00Z") } });
    const b = payload({ positions: { x: { s: 90, t: 9 }, y: { s: 30, t: 1 } } });
    const ab = mergeSync(a, b);
    expect(samePayload(mergeSync(ab, b), ab)).toBe(true);
    expect(samePayload(mergeSync(b, a), ab)).toBe(true);
  });

  it("borne le nombre d'entrées en gardant les plus récentes", () => {
    const positions = Object.fromEntries(Array.from({ length: 1200 }, (_, i) => [`ep${i}`, { s: 30, t: i }]));
    const merged = mergeSync(payload({ positions }), emptyPayload());
    expect(Object.keys(merged.positions)).toHaveLength(1000);
    expect(merged.positions.ep1199).toBeDefined();
    expect(merged.positions.ep0).toBeUndefined();
  });
});

describe("clampFuture", () => {
  it("ramène les horodatages lointains dans le futur à maintenant", () => {
    const now = 1_000_000;
    const clamped = clampFuture(
      payload({
        positions: { ep: { s: 50, t: now + 10 * 86_400_000 }, ok: { s: 50, t: now + 1000 } },
        rate: { v: 1, t: now + 99 * 86_400_000 },
      }),
      now,
    );
    expect(clamped.positions.ep.t).toBe(now);
    expect(clamped.positions.ok.t).toBe(now + 1000);
    expect(clamped.rate?.t).toBe(now);
  });
});

describe("syncPayloadSchema", () => {
  it("accepte un état valide", () => {
    expect(syncPayloadSchema.safeParse(payload({ positions: { ep: { s: 12, t: 1 } }, rate: { v: 1.25, t: 1 } })).success).toBe(true);
  });

  it("refuse des valeurs hors limites", () => {
    expect(syncPayloadSchema.safeParse({ positions: { ep: { s: -1, t: 1 } }, history: {} }).success).toBe(false);
    expect(syncPayloadSchema.safeParse({ positions: { ep: { s: 1, t: 1.5 } }, history: {} }).success).toBe(false);
    expect(syncPayloadSchema.safeParse({ positions: {}, history: {}, rate: { v: 5, t: 1 } }).success).toBe(false);
    expect(syncPayloadSchema.safeParse({ positions: { ["x".repeat(201)]: { s: 1, t: 1 } }, history: {} }).success).toBe(false);
    expect(
      syncPayloadSchema.safeParse({ positions: {}, history: { a: { id: "a", type: "other", status: "started", updatedAt: "x" } } }).success,
    ).toBe(false);
  });
});

describe("sanitizePayload", () => {
  it("écarte les entrées invalides une par une et garde les autres", () => {
    const clean = sanitizePayload({
      positions: { ok: { s: 30, t: 5 }, negatif: { s: -4, t: 5 }, ancien: 120, vide: null },
      history: {
        bon: { id: "bon", type: "podcast", status: "started", updatedAt: "2026-11-01T00:00:00Z" },
        casse: { id: "casse", status: "started" },
      },
      rate: { v: 9, t: 1 },
    });
    expect(Object.keys(clean.positions)).toEqual(["ok"]);
    expect(Object.keys(clean.history)).toEqual(["bon"]);
    expect(clean.rate).toBeUndefined();
  });

  it("renvoie un état vide pour n'importe quelle entrée inexploitable", () => {
    for (const bad of [null, undefined, "texte", 42, []]) {
      expect(sanitizePayload(bad)).toEqual({ positions: {}, history: {} });
    }
  });

  it("produit un état accepté par le schéma serveur", () => {
    const clean = sanitizePayload({ positions: { a: { s: 1, t: 1 }, b: "x" }, history: {}, rate: { v: 1, t: 2 } });
    expect(syncPayloadSchema.safeParse(clean).success).toBe(true);
  });
});
