import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

// Charge le fichier .env du dossier de l'app (sans écraser les variables déjà définies,
// par exemple celles passées par Docker).
const envFile = resolve(import.meta.dirname, "../.env");
if (existsSync(envFile)) process.loadEnvFile(envFile);

function required(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Variable d'environnement manquante : ${name}`);
  return v;
}

const opt = (name: string) => process.env[name]?.trim() || undefined;

export const config = {
  port: Number(process.env.PORT ?? 3210),
  /** URL publique HTTPS de l'app (callbacks OAuth + médias lus par Meta). Sans slash final. */
  publicUrl: (opt("PUBLIC_URL") ?? `http://localhost:${process.env.PORT ?? 3210}`).replace(/\/+$/, ""),
  /** Adresse publique des seuls médias (Instagram/Threads viennent les télécharger). Par défaut : PUBLIC_URL. */
  /** Adresse de l'interface (toujours sur ce PC). */
  appUrl: (opt("APP_URL") ?? `http://127.0.0.1:${process.env.PORT ?? 3210}`).replace(/\/+$/, ""),
  mediaPublicUrl: (opt("MEDIA_PUBLIC_URL") ?? opt("PUBLIC_URL") ?? `http://localhost:${process.env.PORT ?? 3210}`).replace(/\/+$/, ""),
  serverMode: false,
  /** Empreinte scrypt du mot de passe (scripts/hash-password.ts). Obligatoire en mode serveur. */
  adminPasswordHash: opt("ADMIN_PASSWORD_HASH"),
  /** Mot de passe en clair : accepté seulement sur ton PC. */
  adminPassword: opt("ADMIN_PASSWORD"),
  /** Clé de chiffrement des tokens et de signature des cookies (32+ caractères). */
  appSecret: required("APP_SECRET"),
  dataDir: resolve(process.env.DATA_DIR ?? "./data"),
  timezone: process.env.TZ_DISPLAY ?? "Europe/Paris",
  maxUploadBytes: Number(process.env.MAX_UPLOAD_MB ?? 1024) * 1024 * 1024,

  /** Secret de l'adresse de réveil /cron/tick (tâche planifiée de l'hébergeur). 32 caractères min. */
  cronSecret: opt("CRON_SECRET"),
  /** Webhook Discord / Slack / ntfy pour les alertes (facultatif). */
  alertWebhookUrl: opt("ALERT_WEBHOOK_URL"),
  canva: { clientId: opt("CANVA_CLIENT_ID"), clientSecret: opt("CANVA_CLIENT_SECRET") },
  meta: { appId: opt("META_APP_ID"), appSecret: opt("META_APP_SECRET") },
  threads: { appId: opt("THREADS_APP_ID"), appSecret: opt("THREADS_APP_SECRET") },
  x: { clientId: opt("X_CLIENT_ID"), clientSecret: opt("X_CLIENT_SECRET") },
  google: { clientId: opt("GOOGLE_CLIENT_ID"), clientSecret: opt("GOOGLE_CLIENT_SECRET") },
  tiktok: { clientKey: opt("TIKTOK_CLIENT_KEY"), clientSecret: opt("TIKTOK_CLIENT_SECRET") },
};

if (config.appSecret.length < 32) throw new Error("APP_SECRET doit faire au moins 32 caractères");

/**
 * Mode serveur : l'interface est en ligne (APP_URL en HTTPS). Sécurité renforcée : empreinte du
 * mot de passe obligatoire, double authentification obligatoire, cookies et en-têtes durcis.
 */
export const serverMode = config.appUrl.startsWith("https://");
config.serverMode = serverMode;

// Garde-fou : si l'app écoute au-delà de ce PC (HOST=:: ou 0.0.0.0, cas d'un hébergeur), elle
// DOIT être en mode serveur, avec toutes ses protections. Sinon elle refuse de démarrer.
// (LOCAL_MODE=1 : Docker publié uniquement sur 127.0.0.1, voir docker-compose.yml.)
const listenHost = (process.env.HOST ?? "127.0.0.1").trim();
const exposed = !["127.0.0.1", "localhost", "::1", "[::1]"].includes(listenHost);
if (exposed && !serverMode && process.env.LOCAL_MODE !== "1") {
  throw new Error(
    `Sécurité : HOST=${listenHost} rend l'app joignable depuis Internet, mais APP_URL n'est pas une adresse https ` +
      `(valeur lue : ${process.env.APP_URL ? `« ${process.env.APP_URL} »` : "absente"}). ` +
      "Ajoute APP_URL=https://ton-adresse dans les variables d'environnement, puis redémarre.",
  );
}
if (serverMode) {
  if (!config.adminPasswordHash) throw new Error("Mode serveur : ADMIN_PASSWORD_HASH est obligatoire (voir scripts/hash-password.ts). Ne mets pas le mot de passe en clair.");
  if (config.adminPassword) throw new Error("Mode serveur : retire ADMIN_PASSWORD, seul ADMIN_PASSWORD_HASH est accepté.");
} else if (!config.adminPasswordHash && !config.adminPassword) {
  throw new Error("Variable d'environnement manquante : ADMIN_PASSWORD (ou ADMIN_PASSWORD_HASH)");
}

export const mediaDir = resolve(config.dataDir, "media");
mkdirSync(mediaDir, { recursive: true });

/**
 * Adresse de retour OAuth. Canva accepte http://127.0.0.1 : il reste en local. Les autres réseaux
 * reviennent sur PUBLIC_URL (HTTPS), où seul le chemin /oauth a besoin d'être ouvert.
 */
export const callbackUrl = (provider: string) =>
  `${provider === "canva" || provider === "gdrive" ? config.appUrl : config.publicUrl}/oauth/${provider}/callback`;

/** Après une connexion, on revient toujours sur l'interface locale. */
export const accountsPage = (msg: string, ok: boolean) => `${config.appUrl}/#accounts?${ok ? "ok" : "err"}=${encodeURIComponent(msg)}`;
