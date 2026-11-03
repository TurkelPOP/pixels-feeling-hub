import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

function required(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Variable d'environnement manquante : ${name}`);
  return v;
}

const opt = (name: string) => process.env[name]?.trim() || undefined;

export const config = {
  port: Number(process.env.PORT ?? 3210),
  /** URL publique HTTPS de l'app (callbacks OAuth + médias lus par Meta). Sans slash final. */
  publicUrl: required("PUBLIC_URL").replace(/\/+$/, ""),
  adminPassword: required("ADMIN_PASSWORD"),
  /** Clé de chiffrement des tokens et de signature des cookies (32+ caractères). */
  appSecret: required("APP_SECRET"),
  dataDir: resolve(process.env.DATA_DIR ?? "./data"),
  timezone: process.env.TZ_DISPLAY ?? "Europe/Paris",
  maxUploadBytes: Number(process.env.MAX_UPLOAD_MB ?? 1024) * 1024 * 1024,

  meta: { appId: opt("META_APP_ID"), appSecret: opt("META_APP_SECRET") },
  threads: { appId: opt("THREADS_APP_ID"), appSecret: opt("THREADS_APP_SECRET") },
  x: { clientId: opt("X_CLIENT_ID"), clientSecret: opt("X_CLIENT_SECRET") },
  google: { clientId: opt("GOOGLE_CLIENT_ID"), clientSecret: opt("GOOGLE_CLIENT_SECRET") },
  tiktok: { clientKey: opt("TIKTOK_CLIENT_KEY"), clientSecret: opt("TIKTOK_CLIENT_SECRET") },
};

if (config.appSecret.length < 32) throw new Error("APP_SECRET doit faire au moins 32 caractères");

export const mediaDir = resolve(config.dataDir, "media");
mkdirSync(mediaDir, { recursive: true });

export const callbackUrl = (provider: string) => `${config.publicUrl}/oauth/${provider}/callback`;
