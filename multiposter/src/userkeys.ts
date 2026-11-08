// Apps développeur PAR PERSONNE : chaque personne peut déclarer ses propres clés (son app Meta,
// son projet Google, son app TikTok…). Ses connexions, publications, renouvellements d'accès et
// statistiques passent alors par SON app, jamais par celle du propriétaire.
//
// Fonctionnement : config.meta, config.google… deviennent des « vues » qui, pendant une requête
// ou une publication faite pour une personne, renvoient les clés de cette personne
// (AsyncLocalStorage). Le propriétaire utilise les clés globales (Réglages des réseaux).
import { AsyncLocalStorage } from "node:async_hooks";

import type { Context, Hono } from "hono";

import { currentUser, ownerId } from "./auth.ts";
import { config } from "./config.ts";
import { seal, unseal } from "./crypto.ts";
import { db } from "./db.ts";

type Net = "canva" | "meta" | "threads" | "google" | "tiktok" | "x";
/** Réglage → réseau et propriété de config. */
const KEYS: Record<string, [Net, string]> = {
  CANVA_CLIENT_ID: ["canva", "clientId"], CANVA_CLIENT_SECRET: ["canva", "clientSecret"],
  META_APP_ID: ["meta", "appId"], META_APP_SECRET: ["meta", "appSecret"],
  THREADS_APP_ID: ["threads", "appId"], THREADS_APP_SECRET: ["threads", "appSecret"],
  GOOGLE_CLIENT_ID: ["google", "clientId"], GOOGLE_CLIENT_SECRET: ["google", "clientSecret"],
  TIKTOK_CLIENT_KEY: ["tiktok", "clientKey"], TIKTOK_CLIENT_SECRET: ["tiktok", "clientSecret"],
  X_CLIENT_ID: ["x", "clientId"], X_CLIENT_SECRET: ["x", "clientSecret"],
};
const NETS: Net[] = ["canva", "meta", "threads", "google", "tiktok", "x"];

type Overrides = Partial<Record<Net, Record<string, string | null>>>;
const als = new AsyncLocalStorage<Overrides>();

// Les blocs de clés de config deviennent des vues dépendant de la personne en cours.
for (const n of NETS) {
  const base = (config as any)[n] as Record<string, unknown>;
  (config as any)[n] = new Proxy(base, {
    get(target, prop: string) {
      const o = als.getStore()?.[n];
      return o && prop in o ? o[prop] : target[prop];
    },
  });
}

const dbKey = (uid: number, key: string) => `user_app:${uid}:${key}`;
function stored(uid: number, key: string): string | null {
  const r = db.prepare("SELECT value FROM settings WHERE key = ?").get(dbKey(uid, key)) as { value: string } | undefined;
  return r ? unseal(r.value) : null;
}

/** Les autres personnes doivent-elles utiliser leurs propres apps ? (oui par défaut) */
export function ownAppsRequired(): boolean {
  const r = db.prepare("SELECT value FROM settings WHERE key = 'policy:own_apps'").get() as { value: string } | undefined;
  return r?.value !== "0";
}

/** Clés à utiliser pour une personne : les siennes ; à défaut, rien (si chacun doit avoir son app). */
export function overridesFor(uid: number | null | undefined): Overrides {
  if (uid == null || uid === ownerId()) return {};
  const strict = ownAppsRequired();
  const out: Overrides = {};
  for (const n of NETS) {
    const entries = Object.entries(KEYS).filter(([, [net]]) => net === n);
    const vals = Object.fromEntries(entries.map(([k, [, prop]]) => [prop, stored(uid, k)]));
    const complete = Object.values(vals).every(Boolean);
    if (complete) out[n] = vals;
    else if (strict) out[n] = Object.fromEntries(entries.map(([, [, prop]]) => [prop, null]));
  }
  return out;
}

/** Exécute fn avec les clés d'app de cette personne. */
export const runAs = <T>(uid: number | null | undefined, fn: () => T): T => als.run(overridesFor(uid), fn);

/** Middleware : toute la requête utilise les clés de la personne connectée. */
export const userKeysMiddleware = async (c: Context, next: () => Promise<void>) => runAs(currentUser(c)?.id, next);

const LABELS: Record<Net, string> = { canva: "Canva", meta: "Facebook + Instagram", threads: "Threads", google: "YouTube et Google Drive", tiktok: "TikTok", x: "X" };

export function registerUserKeysApi(api: Hono) {
  const uid = (c: Context) => currentUser(c)!.id;

  /** Mes clés d'app (identifiants affichés, secrets jamais renvoyés). */
  api.get("/my-app-settings", (c) => {
    const me = uid(c);
    return c.json({
      isOwner: me === ownerId(),
      strict: ownAppsRequired(),
      networks: NETS.map((n) => ({
        id: n, label: LABELS[n],
        fields: Object.entries(KEYS).filter(([, [net]]) => net === n).map(([key]) => {
          const v = stored(me, key);
          const secret = /SECRET/.test(key);
          return { key, secret, set: !!v, value: secret ? null : (v ?? "") };
        }),
      })),
    });
  });

  api.put("/my-app-settings", async (c) => {
    const me = uid(c);
    const b = await c.req.json<Record<string, string>>().catch(() => ({}) as Record<string, string>);
    for (const [key, raw] of Object.entries(b)) {
      if (!KEYS[key]) return c.json({ error: `Réglage inconnu : ${key}` }, 400);
      const v = String(raw ?? "").trim();
      if (v && (/\s/.test(v) || v.length > 500 || /^[<"']/.test(v))) return c.json({ error: `${key} : valeur invalide (espaces, < > ou guillemets ?)` }, 400);
      if (!v) db.prepare("DELETE FROM settings WHERE key = ?").run(dbKey(me, key));
      else db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value").run(dbKey(me, key), seal(v));
    }
    return c.json({ ok: true });
  });

  /** Propriétaire : imposer (ou non) que chacun utilise sa propre app. */
  api.put("/app-policy", async (c) => {
    if (uid(c) !== ownerId()) return c.json({ error: "Réservé au propriétaire." }, 403);
    const { ownApps } = await c.req.json<{ ownApps?: boolean }>().catch(() => ({ ownApps: true }));
    db.prepare("INSERT INTO settings (key, value) VALUES ('policy:own_apps', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value").run(ownApps === false ? "0" : "1");
    return c.json({ ok: true });
  });
}

export function removeUserKeys(uid: number) {
  db.prepare("DELETE FROM settings WHERE key LIKE ?").run(`user_app:${uid}:%`);
}
