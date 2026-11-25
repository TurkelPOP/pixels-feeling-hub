import { beforeEach, describe, expect, it } from "vitest";

import {
  SYNC_DIRTY_EVENT,
  applyPlaybackFromSync,
  clearPosition,
  getResumePosition,
  loadRate,
  nextRate,
  readPlaybackForSync,
  savePosition,
  saveRate,
} from "./podcastPlayback";

let store: Map<string, string>;
let events: string[];

function installStorage(initial: Record<string, string> = {}) {
  store = new Map(Object.entries(initial));
  events = [];
  (globalThis as { window?: unknown }).window = {
    dispatchEvent: (e: Event) => {
      events.push(e.type);
      return true;
    },
  };
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  };
}

describe("podcastPlayback", () => {
  beforeEach(() => installStorage());

  it("reprend à la position sauvegardée", () => {
    savePosition("ep1", 125.7);
    expect(getResumePosition("ep1", 3600)).toBe(125);
  });

  it("repart du début si la position est trop proche du début ou de la fin", () => {
    savePosition("ep1", 4);
    expect(getResumePosition("ep1", 3600)).toBe(0);
    savePosition("ep2", 3595);
    expect(getResumePosition("ep2", 3600)).toBe(0);
  });

  it("oublie la position effacée en gardant une trace datée pour la synchronisation", () => {
    savePosition("ep1", 300);
    clearPosition("ep1");
    expect(getResumePosition("ep1", 3600)).toBe(0);
    expect(readPlaybackForSync().positions.ep1.s).toBe(0);
  });

  it("n'invente pas d'entrée pour un épisode jamais écouté", () => {
    savePosition("ep1", 3);
    clearPosition("ep1");
    expect(readPlaybackForSync().positions).toEqual({});
  });

  it("garde la vitesse valide et ignore les valeurs inconnues", () => {
    expect(loadRate()).toBe(1);
    saveRate(1.5);
    expect(loadRate()).toBe(1.5);
    saveRate(3);
    expect(loadRate()).toBe(1);
  });

  it("fait défiler les vitesses en boucle", () => {
    expect(nextRate(1)).toBe(1.25);
    expect(nextRate(2)).toBe(0.75);
  });

  it("lit l'ancien format (secondes sans date) comme la valeur la plus ancienne", () => {
    installStorage({ pp_podcast_positions: JSON.stringify({ ep1: 200 }) });
    expect(getResumePosition("ep1", 3600)).toBe(200);
    expect(readPlaybackForSync().positions.ep1).toEqual({ s: 200, t: 0 });
  });

  it("signale un changement à synchroniser", () => {
    savePosition("ep1", 100);
    saveRate(2);
    expect(events.filter((e) => e === SYNC_DIRTY_EVENT)).toHaveLength(2);
  });

  it("applique l'état du serveur sans écraser une position locale plus récente", () => {
    savePosition("ep1", 500);
    const now = Date.now();
    applyPlaybackFromSync({
      positions: { ep1: { s: 40, t: now - 60_000 }, ep2: { s: 900, t: now } },
    });
    expect(getResumePosition("ep1", 3600)).toBe(500);
    expect(getResumePosition("ep2", 3600)).toBe(900);
  });

  it("applique la vitesse du serveur si elle est plus récente, sans renvoyer de changement à synchroniser", () => {
    saveRate(1.5);
    events = [];
    applyPlaybackFromSync({ positions: {}, rate: { v: 2, t: Date.now() + 1000 } });
    expect(loadRate()).toBe(2);
    expect(events).not.toContain(SYNC_DIRTY_EVENT);
  });
});
