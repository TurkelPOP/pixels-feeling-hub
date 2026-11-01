import { describe, expect, it } from "vitest";

import { SESSION_MAX_AGE_S, hasUsableSecret, signSession, verifySession } from "./session.token";

const SECRET = "x".repeat(40);
const NOW = Date.parse("2026-11-02T12:00:00Z");

describe("session token", () => {
  it("restitue l'identifiant d'un jeton valide", () => {
    expect(verifySession(signSession("12345", SECRET, NOW), SECRET, NOW + 1000)).toBe("12345");
  });

  it("refuse un jeton expiré", () => {
    const token = signSession("12345", SECRET, NOW);
    expect(verifySession(token, SECRET, NOW + (SESSION_MAX_AGE_S + 5) * 1000)).toBeNull();
  });

  it("refuse un jeton modifié (autre identifiant ou expiration prolongée)", () => {
    const [v, , exp, sig] = signSession("12345", SECRET, NOW).split(".");
    expect(verifySession([v, "99999", exp, sig].join("."), SECRET, NOW)).toBeNull();
    expect(verifySession([v, "12345", String(Number(exp) + 10_000_000), sig].join("."), SECRET, NOW)).toBeNull();
  });

  it("refuse un jeton signé avec un autre secret", () => {
    expect(verifySession(signSession("12345", "y".repeat(40), NOW), SECRET, NOW)).toBeNull();
  });

  it("refuse les formats invalides", () => {
    for (const bad of [undefined, "", "abc", "v1.12345.9999999999", "v2.1.2.3", "v1.abc.1.sig", "v1.1.2.3.4"]) {
      expect(verifySession(bad, SECRET, NOW)).toBeNull();
    }
  });

  it("n'accepte qu'un secret assez long", () => {
    expect(hasUsableSecret(undefined)).toBe(false);
    expect(hasUsableSecret("court")).toBe(false);
    expect(hasUsableSecret(SECRET)).toBe(true);
  });
});
