// Session de synchronisation : un cookie HttpOnly signé contenant seulement l'identifiant Twitch.
// Le jeton d'accès Twitch n'y figure jamais (il est révoqué dès la connexion terminée).
import { deleteCookie, getCookie, getRequestHeader, getRequestUrl, setCookie } from "@tanstack/react-start/server";

import { SESSION_MAX_AGE_S, hasUsableSecret, signSession, verifySession } from "./session.token";

export const SESSION_COOKIE = "pp_session";

function secret(): string | null {
  const value = process.env.SESSION_SECRET;
  return hasUsableSecret(value) ? value : null;
}

/** La synchronisation exige un SESSION_SECRET d'au moins 32 caractères côté serveur. */
export function sessionConfigured(): boolean {
  return secret() !== null;
}

function cookieOptions() {
  // `Secure` dès que le site est servi en https (y compris derrière le proxy de l'hébergeur).
  const secure = getRequestUrl({ xForwardedHost: true, xForwardedProto: true }).protocol === "https:";
  return { httpOnly: true, sameSite: "lax" as const, secure, path: "/" };
}

/** Ouvre une session pour cet utilisateur Twitch. Renvoie false si la synchronisation n'est pas configurée. */
export function startSession(userId: string): boolean {
  const key = secret();
  if (!key) return false;
  setCookie(SESSION_COOKIE, signSession(userId, key), { ...cookieOptions(), maxAge: SESSION_MAX_AGE_S });
  return true;
}

/** Identifiant Twitch de la session en cours, ou null (pas de cookie, jeton falsifié ou expiré). */
export function currentUserId(): string | null {
  const key = secret();
  if (!key) return null;
  return verifySession(getCookie(SESSION_COOKIE), key);
}

export function endSession(): void {
  deleteCookie(SESSION_COOKIE, cookieOptions());
}

/**
 * Défense en plus de SameSite=Lax : une requête qui porte un en-tête Origin doit venir de ce site.
 * Les origines autorisées sont celle de la requête et SITE_URL / VITE_SITE_URL si définies.
 */
export function isSameOrigin(): boolean {
  const origin = getRequestHeader("origin");
  if (!origin) return true;
  const allowed = new Set<string>([getRequestUrl({ xForwardedHost: true, xForwardedProto: true }).origin]);
  const configured = process.env.SITE_URL || process.env.VITE_SITE_URL;
  if (configured) {
    try {
      allowed.add(new URL(configured).origin);
    } catch {
      // SITE_URL mal formée : ignorée.
    }
  }
  return allowed.has(origin);
}
