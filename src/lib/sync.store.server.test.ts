import { describe, expect, it } from "vitest";

import type { SyncPayload } from "./sync.merge";
import { createSqliteStore } from "./sync.store.server";

const payload = (s: number, t: number): SyncPayload => ({
  positions: { ep: { s, t } },
  history: {},
});

describe("sqlite sync store", () => {
  it("renvoie l'état fusionné et le garde entre deux échanges", async () => {
    const store = await createSqliteStore(":memory:");
    expect(store.exchange("u1", payload(100, 1000)).positions.ep.s).toBe(100);
    // Un appareil en retard n'écrase pas la position la plus récente.
    expect(store.exchange("u1", payload(40, 500)).positions.ep.s).toBe(100);
    // Un échange vide restitue l'état stocké (nouvel appareil).
    expect(store.exchange("u1", { positions: {}, history: {} }).positions.ep.s).toBe(100);
    store.close();
  });

  it("isole les utilisateurs", async () => {
    const store = await createSqliteStore(":memory:");
    store.exchange("u1", payload(100, 1000));
    expect(store.exchange("u2", { positions: {}, history: {} }).positions).toEqual({});
    store.close();
  });

  it("supprime les données d'un utilisateur", async () => {
    const store = await createSqliteStore(":memory:");
    store.exchange("u1", payload(100, 1000));
    store.remove("u1");
    expect(store.exchange("u1", { positions: {}, history: {} }).positions).toEqual({});
    store.close();
  });

  it("ramène une date lointaine dans le futur à maintenant", async () => {
    const store = await createSqliteStore(":memory:");
    const far = Date.now() + 90 * 86_400_000;
    const merged = store.exchange("u1", payload(100, far));
    expect(merged.positions.ep.t).toBeLessThan(far);
    store.close();
  });
});
