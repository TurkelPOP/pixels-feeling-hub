// Jeton de session signé (HMAC-SHA256) : il ne contient que l'identifiant Twitch et une date d'expiration.
// Aucun jeton Twitch n'y figure. Pur (node:crypto seulement) pour pouvoir le tester sans serveur.
import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_MAX_AGE_S = 60 * 60 * 24 * 30;
const VERSION = "v1";
const MIN_SECRET_LENGTH = 32;

/** Un secret trop court ou absent désactive la synchronisation plutôt que d'accepter un jeton faible. */
export function hasUsableSecret(secret: string | undefined): secret is string {
  return typeof secret === "string" && secret.length >= MIN_SECRET_LENGTH;
}

function sign(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("base64url");
}

export function signSession(userId: string, secret: string, now = Date.now()): string {
  const expires = Math.floor(now / 1000) + SESSION_MAX_AGE_S;
  const body = `${VERSION}.${userId}.${expires}`;
  return `${body}.${sign(body, secret)}`;
}

/** Renvoie l'identifiant Twitch si le jeton est authentique et non expiré, sinon null. */
export function verifySession(token: string | undefined, secret: string, now = Date.now()): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 4 || parts[0] !== VERSION) return null;
  const [version, userId, expires, signature] = parts;
  if (!/^\d{1,20}$/.test(userId) || !/^\d{1,12}$/.test(expires)) return null;

  const expected = Buffer.from(sign(`${version}.${userId}.${expires}`, secret));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  if (Number(expires) * 1000 < now) return null;
  return userId;
}
