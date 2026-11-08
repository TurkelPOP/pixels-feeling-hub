// Réglages de l'application modifiables depuis l'interface (propriétaire uniquement) : clés des
// apps développeur des réseaux et webhook d'alertes. Stockés chiffrés dans la base ; une variable
// d'environnement définie sur le serveur reste prioritaire et n'est pas modifiable ici.
import type { Context, Hono } from "hono";

import { alert } from "./alerts.ts";
import { confirmIdentity, currentUser } from "./auth.ts";
import { callbackUrl, config } from "./config.ts";
import { seal, unseal } from "./crypto.ts";
import { db } from "./db.ts";

interface Field {
  key: string;
  label: string;
  secret: boolean;
  apply: (v: string | undefined) => void;
}

interface Group {
  id: string;
  label: string;
  /** Adresse de retour à déclarer chez le réseau (absente pour les alertes). */
  callback?: () => string;
  console?: string;
  help: string;
  fields: Field[];
}

export const GROUPS: Group[] = [
  {
    id: "canva", label: "Canva", callback: () => callbackUrl("canva"), console: "https://www.canva.com/developers/apps",
    help: "Ton app → Outside Canva → Credentials (Client ID et secret). Coche les scopes design:meta, design:content et profile en lecture.",
    fields: [
      { key: "CANVA_CLIENT_ID", label: "Client ID", secret: false, apply: (v) => (config.canva.clientId = v) },
      { key: "CANVA_CLIENT_SECRET", label: "Client secret", secret: true, apply: (v) => (config.canva.clientSecret = v) },
    ],
  },
  {
    id: "meta", label: "Facebook + Instagram (Meta)", callback: () => callbackUrl("meta"), console: "https://developers.facebook.com/apps",
    help: "App de type Business → Paramètres → Général (ID de l'app et clé secrète). Ajoute Facebook Login for Business et l'adresse de retour.",
    fields: [
      { key: "META_APP_ID", label: "ID de l'app", secret: false, apply: (v) => (config.meta.appId = v) },
      { key: "META_APP_SECRET", label: "Clé secrète", secret: true, apply: (v) => (config.meta.appSecret = v) },
    ],
  },
  {
    id: "threads", label: "Threads", callback: () => callbackUrl("threads"), console: "https://developers.facebook.com/apps",
    help: "Dans l'app Meta : cas d'usage « Threads API » → Paramètres (identifiants propres à Threads, différents de ceux de Facebook).",
    fields: [
      { key: "THREADS_APP_ID", label: "ID de l'app Threads", secret: false, apply: (v) => (config.threads.appId = v) },
      { key: "THREADS_APP_SECRET", label: "Clé secrète Threads", secret: true, apply: (v) => (config.threads.appSecret = v) },
    ],
  },
  {
    id: "google", label: "YouTube (Google)", callback: () => callbackUrl("google"), console: "https://console.cloud.google.com/apis/credentials",
    help: "Active « YouTube Data API v3 », puis Identifiants → ID client OAuth de type « Application Web ».",
    fields: [
      { key: "GOOGLE_CLIENT_ID", label: "ID client", secret: false, apply: (v) => (config.google.clientId = v) },
      { key: "GOOGLE_CLIENT_SECRET", label: "Code secret du client", secret: true, apply: (v) => (config.google.clientSecret = v) },
    ],
  },
  {
    id: "tiktok", label: "TikTok", callback: () => callbackUrl("tiktok"), console: "https://developers.tiktok.com/apps",
    help: "App avec Login Kit et Content Posting API (Direct Post). Scopes user.info.basic et video.publish.",
    fields: [
      { key: "TIKTOK_CLIENT_KEY", label: "Client key", secret: false, apply: (v) => (config.tiktok.clientKey = v) },
      { key: "TIKTOK_CLIENT_SECRET", label: "Client secret", secret: true, apply: (v) => (config.tiktok.clientSecret = v) },
    ],
  },
  {
    id: "alerts", label: "Alertes (Discord, Slack, ntfy)",
    help: "Discord : Paramètres du salon → Intégrations → Webhooks → Nouveau webhook → Copier l'URL.",
    fields: [{ key: "ALERT_WEBHOOK_URL", label: "Adresse du webhook", secret: true, apply: (v) => (config.alertWebhookUrl = v) }],
  },
];

const FIELDS = new Map(GROUPS.flatMap((g) => g.fields.map((f) => [f.key, f] as const)));
const envValue = (key: string) => process.env[key]?.trim() || undefined;
const dbKey = (key: string) => `app_cfg:${key}`;

function stored(key: string): string | undefined {
  const r = db.prepare("SELECT value FROM settings WHERE key = ?").get(dbKey(key)) as { value: string } | undefined;
  return r ? (unseal(r.value) ?? undefined) : undefined;
}

/** Applique les réglages enregistrés (la variable d'environnement reste prioritaire). */
export function applyAppSettings() {
  for (const f of FIELDS.values()) f.apply(envValue(f.key) ?? stored(f.key));
}

function validate(key: string, value: string): string | null {
  if (value.length > 500) return "Valeur trop longue.";
  if (/\s/.test(value)) return "La valeur ne doit contenir aucun espace : vérifie ton copier-coller.";
  if (/^[<"'].*[>"']$/.test(value)) return "Retire les signes < > ou les guillemets autour de la valeur.";
  if (key === "ALERT_WEBHOOK_URL" && !/^https:\/\/[^/]+\//.test(value)) return "L'adresse du webhook doit commencer par https://";
  return null;
}

export function registerAppSettingsApi(api: Hono) {
  const ownerOnly = (c: Context) =>
    currentUser(c)?.role === "owner" ? null : c.json({ error: "Réservé au propriétaire du serveur." }, 403);

  api.get("/app-settings", (c) => {
    const denied = ownerOnly(c);
    if (denied) return denied;
    return c.json(
      GROUPS.map((g) => ({
        id: g.id,
        label: g.label,
        callback: g.callback?.() ?? null,
        console: g.console ?? null,
        help: g.help,
        fields: g.fields.map((f) => {
          const env = envValue(f.key);
          const value = env ?? stored(f.key);
          return {
            key: f.key,
            label: f.label,
            secret: f.secret,
            source: env ? "server" : value ? "app" : null,
            // Les identifiants publics sont réaffichés ; les secrets, jamais.
            value: !f.secret ? (value ?? "") : null,
          };
        }),
      })),
    );
  });

  api.put("/app-settings", async (c) => {
    const denied = ownerOnly(c);
    if (denied) return denied;
    const { code, ...body } = await c.req.json<Record<string, string>>().catch(() => ({}) as Record<string, string>);
    // Changer une clé d'app ou le webhook détourne les connexions ou les alertes : code exigé.
    const err = confirmIdentity(c, code);
    if (err) return c.json({ error: err }, 403);
    const changed: string[] = [];
    for (const [key, raw] of Object.entries(body)) {
      const f = FIELDS.get(key);
      if (!f) return c.json({ error: `Réglage inconnu : ${key}` }, 400);
      if (envValue(key)) return c.json({ error: `${f.label} est défini sur le serveur (variable ${key}) : modifie-le là-bas.` }, 400);
      const value = String(raw ?? "").trim();
      if (!value) {
        db.prepare("DELETE FROM settings WHERE key = ?").run(dbKey(key));
      } else {
        const err = validate(key, value);
        if (err) return c.json({ error: `${f.label} : ${err}` }, 400);
        db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value").run(dbKey(key), seal(value));
      }
      changed.push(key);
    }
    applyAppSettings();
    if (changed.length) {
      const who = currentUser(c)!.name;
      db.prepare("INSERT INTO security_events (at, type, ip, agent, detail, user) VALUES (?, 'settings_changed', NULL, NULL, ?, ?)").run(
        Date.now(), changed.join(", "), who,
      );
      void alert(`⚙️ Réglages de PTZ Posting modifiés par « ${who} » : ${changed.join(", ")}.`);
    }
    return c.json({ ok: true });
  });
}
