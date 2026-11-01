import { beforeEach, describe, expect, it } from "vitest";

import { getResumePosition, loadRate, nextRate, saveRate, savePosition, clearPosition } from "./podcastPlayback";

function installStorage() {
  const data = new Map<string, string>();
  (globalThis as { window?: unknown }).window = {};
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

describe("podcastPlayback", () => {
  beforeEach(installStorage);

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

  it("oublie la position effacée", () => {
    savePosition("ep1", 300);
    clearPosition("ep1");
    expect(getResumePosition("ep1", 3600)).toBe(0);
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
});
