// Notifications sur téléphone et ordinateur (Web Push, RFC 8030 / 8291 / 8292), sans service
// externe payant : le navigateur fournit une adresse d'abonnement (Google, Apple, Mozilla…), et
// l'app y envoie un message chiffré que seul cet appareil peut lire.
import { createCipheriv, createECDH, createPrivateKey, hkdfSync, randomBytes, sign } from "node:crypto";

import type { Context, Hono } from "hono";

import { currentUser } from "./auth.ts";
import { config } from "./config.ts";
import { seal, unseal } from "./crypto.ts";
import { db } from "./db.ts";

db.exec(`CREATE TABLE IF NOT EXISTS push_subs (
  id INTEGER PRIMARY KEY, owner_id INTEGER NOT NULL, endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL, auth TEXT NOT NULL, agent TEXT, created_at INTEGER NOT NULL
)`);

const b64u = (b: Buffer) => b.toString("base64url");
const fromB64u = (s: string) => Buffer.from(s, "base64url");

/** Clés VAPID de l'app (créées une fois, gardées chiffrées dans la base). */
function vapid(): { publicKey: Buffer; privateKey: Buffer } {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'vapid'").get() as { value: string } | undefined;
  const saved = row && unseal(row.value);
  if (saved) {
    const { pub, priv } = JSON.parse(saved);
    return { publicKey: fromB64u(pub), privateKey: fromB64u(priv) };
  }
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  const keys = { publicKey: ecdh.getPublicKey(), privateKey: ecdh.getPrivateKey() };
  db.prepare("INSERT INTO settings (key, value) VALUES ('vapid', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value").run(
    seal(JSON.stringify({ pub: b64u(keys.publicKey), priv: b64u(keys.privateKey) })),
  );
  return keys;
}

/** Clé privée P-256 au format KeyObject, à partir des octets bruts. */
function privateKeyObject(priv: Buffer, pub: Buffer) {
  return createPrivateKey({
    key: { kty: "EC", crv: "P-256", d: b64u(priv), x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33, 65)) },
    format: "jwk",
  });
}

/** En-tête Authorization VAPID (RFC 8292) pour le service de notification visé. */
function vapidAuth(endpoint: string): string {
  const { publicKey, privateKey } = vapid();
  const header = b64u(Buffer.from(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const subject = /^https:/.test(config.appUrl) ? config.appUrl : "mailto:contact@ptzcorp.fr";
  const payload = b64u(Buffer.from(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject })));
  const sig = sign("sha256", Buffer.from(`${header}.${payload}`), { key: privateKeyObject(privateKey, publicKey), dsaEncoding: "ieee-p1363" });
  return `vapid t=${header}.${payload}.${b64u(sig)}, k=${b64u(publicKey)}`;
}

/** Chiffre un message pour un abonnement (RFC 8291, aes128gcm, un seul enregistrement). */
export function encryptPayload(plain: Buffer, uaPublic: Buffer, authSecret: Buffer, asKeys = (() => { const e = createECDH("prime256v1"); e.generateKeys(); return e; })(), salt = randomBytes(16)) {
  const asPublic = asKeys.getPublicKey();
  const shared = asKeys.computeSecret(uaPublic);
  const keyInfo = Buffer.concat([Buffer.from("WebPush: info\0"), uaPublic, asPublic]);
  const ikm = Buffer.from(hkdfSync("sha256", shared, authSecret, keyInfo, 32));
  const cek = Buffer.from(hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: aes128gcm\0"), 16));
  const nonce = Buffer.from(hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: nonce\0"), 12));
  const cipher = createCipheriv("aes-128-gcm", cek, nonce);
  const body = Buffer.concat([cipher.update(Buffer.concat([plain, Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const rs = Buffer.alloc(4);
  rs.writeUInt32BE(4096);
  return Buffer.concat([salt, rs, Buffer.from([asPublic.length]), asPublic, body]);
}

interface Sub { id: number; endpoint: string; p256dh: string; auth: string }

async function sendOne(sub: Sub, message: object): Promise<void> {
  const body = encryptPayload(Buffer.from(JSON.stringify(message)), fromB64u(sub.p256dh), fromB64u(sub.auth));
  const res = await fetch(sub.endpoint, {
    method: "POST",
    headers: { TTL: "86400", "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream", Urgency: "normal", Authorization: vapidAuth(sub.endpoint) },
    body,
    signal: AbortSignal.timeout(15_000),
  });
  // Abonnement expiré ou retiré par l'appareil : on l'oublie.
  if (res.status === 404 || res.status === 410) db.prepare("DELETE FROM push_subs WHERE id = ?").run(sub.id);
  else if (!res.ok) console.error(`[notifications] ${new URL(sub.endpoint).host} HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
}

/** Envoie une notification à tous les appareils d'une personne (sans jamais bloquer l'app). */
export async function notify(ownerId: number, msg: { title: string; body: string; url?: string; tag?: string }): Promise<void> {
  const subs = db.prepare("SELECT id, endpoint, p256dh, auth FROM push_subs WHERE owner_id = ?").all(ownerId) as unknown as Sub[];
  await Promise.all(subs.map((s) => sendOne(s, { ...msg, url: msg.url ?? "/" }).catch((e) => console.error("[notifications]", e instanceof Error ? e.message : e))));
}

const ALLOWED_PUSH_HOSTS = /(^|\.)(googleapis\.com|push\.apple\.com|mozilla\.com|mozaws\.net|windows\.com|notify\.windows\.com)$/;

export function registerPushApi(api: Hono) {
  const uid = (c: Context) => currentUser(c)!.id;
  api.get("/push/key", (c) => c.json({ publicKey: b64u(vapid().publicKey) }));

  api.post("/push/subscribe", async (c) => {
    const b = await c.req.json<{ endpoint?: string; keys?: { p256dh?: string; auth?: string } }>().catch(() => ({}) as Record<string, any>);
    let host = "";
    try {
      const u = new URL(String(b.endpoint));
      if (u.protocol !== "https:") throw new Error();
      host = u.hostname;
    } catch {
      return c.json({ error: "Abonnement invalide" }, 400);
    }
    // Seulement les services de notification des navigateurs (pas d'envoi vers une adresse quelconque).
    if (!ALLOWED_PUSH_HOSTS.test(host)) return c.json({ error: `Service de notification non reconnu (${host}).` }, 400);
    const p256dh = String(b.keys?.p256dh ?? ""), auth = String(b.keys?.auth ?? "");
    if (fromB64u(p256dh).length !== 65 || fromB64u(auth).length !== 16) return c.json({ error: "Clés d'abonnement invalides" }, 400);
    db.prepare(
      `INSERT INTO push_subs (owner_id, endpoint, p256dh, auth, agent, created_at) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (endpoint) DO UPDATE SET owner_id = excluded.owner_id, p256dh = excluded.p256dh, auth = excluded.auth, agent = excluded.agent`,
    ).run(uid(c), String(b.endpoint), p256dh, auth, (c.req.header("user-agent") ?? "").slice(0, 200), Date.now());
    return c.json({ ok: true });
  });

  api.post("/push/unsubscribe", async (c) => {
    const b = await c.req.json<{ endpoint?: string }>().catch(() => ({}) as { endpoint?: string });
    db.prepare("DELETE FROM push_subs WHERE endpoint = ? AND owner_id = ?").run(String(b.endpoint ?? ""), uid(c));
    return c.json({ ok: true });
  });

  api.get("/push/devices", (c) =>
    c.json({ count: (db.prepare("SELECT COUNT(*) AS n FROM push_subs WHERE owner_id = ?").get(uid(c)) as { n: number }).n }),
  );

  api.post("/push/test", async (c) => {
    await notify(uid(c), { title: "PTZ Posting", body: "🔔 Les notifications fonctionnent sur cet appareil !", tag: "test" });
    return c.json({ ok: true });
  });
}
