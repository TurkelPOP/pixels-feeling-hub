// Authentification : mot de passe (empreinte scrypt), double authentification TOTP obligatoire
// en mode serveur, codes de secours, sessions révocables, limitation des tentatives, journal.
import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { Context, Hono, Next } from "hono";
import { deleteCookie, getSignedCookie, setSignedCookie } from "hono/cookie";
import qrcode from "qrcode-generator";

import { alert } from "./alerts.ts";
import { config } from "./config.ts";
import { seal, unseal } from "./crypto.ts";
import { db } from "./db.ts";

const PUBLIC = resolve(import.meta.dirname, "../public");
const SESSION_DAYS = config.serverMode ? 7 : 30;
/** En HTTPS, préfixe __Host- : cookie lié à cette seule adresse, impossible à injecter depuis un sous-domaine. */
const SESSION = config.serverMode ? "__Host-mp_session" : "mp_session";

db.exec(`
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS security_events (
  id INTEGER PRIMARY KEY, at INTEGER NOT NULL, type TEXT NOT NULL, ip TEXT, agent TEXT, detail TEXT
);
`);

const getSetting = (k: string) => (db.prepare("SELECT value FROM settings WHERE key = ?").get(k) as { value: string } | undefined)?.value;
const setSetting = (k: string, v: string) =>
  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value").run(k, v);
const delSetting = (k: string) => db.prepare("DELETE FROM settings WHERE key = ?").run(k);

// ---------- Mot de passe ----------

/** Empreinte scrypt au format scrypt$N$r$p$sel$empreinte (base64url). */
export function hashPassword(password: string): string {
  const N = 2 ** 15, r = 8, p = 1;
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 32, { N, r, p, maxmem: 64 * 1024 * 1024 });
  return `scrypt$${N}$${r}$${p}$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

function verifyPassword(password: string): boolean {
  if (config.adminPasswordHash) {
    const [algo, N, r, p, salt, hash] = config.adminPasswordHash.split("$");
    if (algo !== "scrypt" || !hash) return false;
    const expected = Buffer.from(hash, "base64url");
    const got = scryptSync(password, Buffer.from(salt, "base64url"), expected.length, {
      N: Number(N), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024,
    });
    return timingSafeEqual(got, expected);
  }
  const sha = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(sha(password), sha(config.adminPassword ?? randomBytes(16).toString("hex")));
}

// ---------- TOTP (RFC 6238) ----------

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function base32(buf: Buffer): string {
  let bits = 0, value = 0, out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}
function unbase32(s: string): Buffer {
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const ch of s.replace(/[\s=]/g, "").toUpperCase()) {
    const i = B32.indexOf(ch);
    if (i < 0) continue;
    value = (value << 5) | i;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}
export function totp(secret: string, counter: number): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = createHmac("sha1", unbase32(secret)).update(msg).digest();
  const o = h[h.length - 1] & 15;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

const totpSecret = () => unseal(getSetting("totp_secret"));
export const twoFactorEnabled = () => !!getSetting("totp_secret");

/** Vérifie un code (±30 s) et refuse sa réutilisation. */
function checkTotp(code: string, secret: string, commit = true): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  const now = Math.floor(Date.now() / 30_000);
  const last = Number(getSetting("totp_last") ?? -1);
  for (const c of [now - 1, now, now + 1]) {
    if (c <= last) continue;
    if (timingSafeEqual(Buffer.from(totp(secret, c)), Buffer.from(code))) {
      if (commit) setSetting("totp_last", String(c));
      return true;
    }
  }
  return false;
}

const hashCode = (code: string) => createHash("sha256").update(`recovery:${code.toLowerCase().replace(/[^a-z0-9]/g, "")}`).digest("hex");

function newRecoveryCodes(): string[] {
  const codes = Array.from({ length: 10 }, () => {
    const s = base32(randomBytes(5)).toLowerCase();
    return `${s.slice(0, 4)}-${s.slice(4, 8)}`;
  });
  setSetting("recovery_codes", JSON.stringify(codes.map(hashCode)));
  return codes;
}

function useRecoveryCode(code: string): boolean {
  const list: string[] = JSON.parse(getSetting("recovery_codes") ?? "[]");
  const h = hashCode(code);
  const i = list.indexOf(h);
  if (i < 0) return false;
  list.splice(i, 1);
  setSetting("recovery_codes", JSON.stringify(list));
  return true;
}

// Réinitialisation de secours, depuis le serveur uniquement (variable TWOFA_RESET=1 au démarrage).
if (process.env.TWOFA_RESET === "1") {
  for (const k of ["totp_secret", "totp_pending", "totp_last", "recovery_codes"]) delSetting(k);
  console.log("Double authentification réinitialisée (TWOFA_RESET=1). Retire cette variable maintenant.");
}

// ---------- Journal et limitation ----------

export function clientIp(c: Context): string {
  // Derrière le proxy d'alwaysdata (TRUST_PROXY=1) : la dernière adresse ajoutée par le proxy est la vraie.
  if (process.env.TRUST_PROXY === "1") {
    const xff = c.req.header("x-forwarded-for")?.split(",").map((s) => s.trim()).filter(Boolean);
    if (xff?.length) return xff[xff.length - 1];
  }
  return "local";
}

function logEvent(c: Context | null, type: string, detail = "") {
  db.prepare("INSERT INTO security_events (at, type, ip, agent, detail) VALUES (?, ?, ?, ?, ?)").run(
    Date.now(), type, c ? clientIp(c) : null, c ? (c.req.header("user-agent") ?? "").slice(0, 200) : null, detail.slice(0, 300),
  );
  db.prepare("DELETE FROM security_events WHERE id NOT IN (SELECT id FROM security_events ORDER BY id DESC LIMIT 500)").run();
}

export function securityEvents(limit = 50) {
  return db.prepare("SELECT at, type, ip, agent, detail FROM security_events ORDER BY id DESC LIMIT ?").all(limit);
}

const failures = new Map<string, { count: number; until: number }>();
let globalFailures: number[] = [];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------- Sessions ----------

// Contenu : expiration . époque . empreinte des identifiants . étape (f = complète, e = activation 2FA).
// Changer le mot de passe, « Déconnecter tous les appareils » ou activer la 2FA ferme les sessions.
const credentialFingerprint = createHash("sha256")
  .update(`session:${config.adminPasswordHash ?? config.adminPassword}:${config.appSecret}`)
  .digest("hex")
  .slice(0, 24);
const sessionEpoch = () => getSetting("session_epoch") ?? "0";
const bumpEpoch = () => setSetting("session_epoch", String(Number(sessionEpoch()) + 1));

async function sessionStage(c: Context): Promise<"f" | "e" | null> {
  const v = await getSignedCookie(c, config.appSecret, SESSION);
  if (!v) return null;
  const [exp, epoch, fp, stage] = v.split(".");
  if (!(Number(exp) > Date.now() && epoch === sessionEpoch() && fp === credentialFingerprint)) return null;
  if (stage === "f") return config.serverMode && !twoFactorEnabled() ? null : "f";
  return stage === "e" ? "e" : null;
}

async function openSession(c: Context, stage: "f" | "e") {
  const ttl = stage === "e" ? 15 * 60_000 : SESSION_DAYS * 86_400_000;
  await setSignedCookie(c, SESSION, `${Date.now() + ttl}.${sessionEpoch()}.${credentialFingerprint}.${stage}`, config.appSecret, {
    httpOnly: true,
    secure: config.serverMode || !/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(c.req.header("host") ?? ""),
    sameSite: "Lax",
    path: "/",
    maxAge: ttl / 1000,
  });
}

export const isLogged = async (c: Context) => (await sessionStage(c)) === "f";

export async function requireAuth(c: Context, next: Next) {
  if (await isLogged(c)) {
    // Les requêtes d'API qui modifient quelque chose doivent venir de notre JS (anti-CSRF).
    if (c.req.path.startsWith("/api/") && c.req.method !== "GET" && c.req.header("x-requested-with") !== "multiposter") {
      return c.json({ error: "Requête refusée" }, 403);
    }
    return next();
  }
  if (c.req.path.startsWith("/api/")) return c.json({ error: "Non connecté" }, 401);
  return c.redirect("/login");
}

// ---------- Pages ----------

const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

function page(title: string, body: string) {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>${esc(title)} · Multiposter</title><link rel="icon" href="/assets/logo.png">
<link rel="stylesheet" href="/assets/styles.css"></head><body class="login"><main class="card login-card wide">${body}</main></body></html>`;
}

function setupPage(secret: string, error = "") {
  const uri = `otpauth://totp/Multiposter:${encodeURIComponent("Pixels Perspective")}?secret=${secret}&issuer=Multiposter&digits=6&period=30`;
  const qr = qrcode(0, "M");
  qr.addData(uri);
  qr.make();
  const svg = qr.createSvgTag({ cellSize: 5, margin: 3, scalable: true });
  return page("Double authentification", `
<img src="/assets/logo.png" alt="" width="56" height="56">
<h1>Double authentification</h1>
<p class="muted">Obligatoire pour protéger l'app. Il te faudra ton téléphone à chaque connexion.</p>
<ol class="steps">
  <li>Installe <strong>Google Authenticator</strong> (ou Microsoft Authenticator, 2FAS…) sur ton téléphone.</li>
  <li>Dans l'appli, ajoute un compte en <strong>scannant ce QR code</strong> :</li>
</ol>
<div class="qr">${svg}</div>
<p class="muted small">Impossible de scanner ? Choisis « Saisir une clé » et tape : <code class="key">${esc(secret.match(/.{1,4}/g)!.join(" "))}</code></p>
<form method="post" action="/2fa/setup">
  <label for="code">3. Tape le code à 6 chiffres affiché par l'appli</label>
  <input id="code" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="\\d{6}" maxlength="6" required autofocus>
  ${error ? `<p class="error">${esc(error)}</p>` : ""}
  <button class="btn primary" type="submit">Activer</button>
</form>`);
}

function codesPage(codes: string[]) {
  return page("Codes de secours", `
<h1>Codes de secours</h1>
<p>La double authentification est activée. Voici <strong>10 codes de secours</strong> : chacun remplace une fois le code du téléphone, si tu le perds.</p>
<p class="error"><strong>Note-les maintenant</strong> dans un endroit sûr (gestionnaire de mots de passe, papier) : ils ne seront plus jamais affichés.</p>
<ul class="codes">${codes.map((c) => `<li><code>${c}</code></li>`).join("")}</ul>
<a class="btn primary" href="/">J'ai noté mes codes, ouvrir l'app</a>`);
}

// ---------- Routes ----------

export function registerAuth(app: Hono) {
  app.get("/login", async (c) => c.html(await readFile(resolve(PUBLIC, "login.html"), "utf8")));
  app.get("/login/info", (c) => c.json({ twoFactor: twoFactorEnabled() }));

  app.post("/login", async (c) => {
    const ip = clientIp(c);
    const f = failures.get(ip);
    if (f && f.until > Date.now()) return c.redirect("/login?e=wait");
    // Attaque massive (beaucoup d'échecs, toutes adresses confondues) : on ralentit chaque essai.
    globalFailures = globalFailures.filter((t) => t > Date.now() - 3_600_000);
    if (globalFailures.length > 20) await sleep(3_000);

    const body = await c.req.parseBody();
    const password = String(body.password ?? "");
    const code = String(body.code ?? "").trim();
    let ok = verifyPassword(password);
    let usedRecovery = false;
    if (ok && twoFactorEnabled()) {
      ok = checkTotp(code, totpSecret()!);
      if (!ok && /^[a-z0-9]{4}-?[a-z0-9]{4}$/i.test(code)) ok = usedRecovery = useRecoveryCode(code);
    }
    if (!ok) {
      const count = (f?.count ?? 0) + 1;
      const locked = count >= 5;
      failures.set(ip, { count, until: locked ? Date.now() + 15 * 60_000 : 0 });
      globalFailures.push(Date.now());
      logEvent(c, "login_fail", locked ? "adresse bloquée 15 min" : "");
      if (locked) void alert(`🚨 Multiposter : 5 échecs de connexion depuis ${ip}, adresse bloquée 15 min.`);
      if (globalFailures.length === 21) void alert("🚨 Multiposter : plus de 20 échecs de connexion en 1 h. Les essais sont ralentis.");
      // Message identique pour un mot de passe ou un code faux : on ne révèle rien.
      return c.redirect("/login?e=1");
    }
    failures.delete(ip);

    if (config.serverMode && !twoFactorEnabled()) {
      await openSession(c, "e");
      logEvent(c, "login_setup", "activation de la double authentification");
      return c.redirect("/2fa/setup");
    }
    await openSession(c, "f");
    logEvent(c, "login_ok", usedRecovery ? "avec un code de secours" : "");
    void alert(
      `🔐 Connexion à Multiposter depuis ${ip}${usedRecovery ? " avec un CODE DE SECOURS" : ""} (${(c.req.header("user-agent") ?? "").slice(0, 80)}). Si ce n'est pas toi : « Déconnecter tous les appareils » et change le mot de passe.`,
    );
    return c.redirect("/");
  });

  // Activation de la double authentification (session d'activation, ou session complète sans 2FA).
  const canSetup = async (c: Context) => !twoFactorEnabled() && (await sessionStage(c)) !== null;

  app.get("/2fa/setup", async (c) => {
    if (!(await canSetup(c))) return c.redirect("/login");
    let secret = unseal(getSetting("totp_pending"));
    if (!secret) {
      secret = base32(randomBytes(20));
      setSetting("totp_pending", seal(secret)!);
    }
    return c.html(setupPage(secret));
  });

  app.post("/2fa/setup", async (c) => {
    if (!(await canSetup(c))) return c.redirect("/login");
    const secret = unseal(getSetting("totp_pending"));
    const code = String((await c.req.parseBody()).code ?? "").trim();
    if (!secret) return c.redirect("/2fa/setup");
    if (!checkTotp(code, secret, false)) return c.html(setupPage(secret, "Code incorrect. Vérifie l'heure de ton téléphone et réessaie."), 400);
    setSetting("totp_secret", seal(secret)!);
    delSetting("totp_pending");
    checkTotp(code, secret); // marque ce code comme utilisé
    const codes = newRecoveryCodes();
    bumpEpoch(); // ferme toute autre session ouverte avant la 2FA
    await openSession(c, "f");
    logEvent(c, "2fa_enabled");
    void alert("🔐 Double authentification activée sur Multiposter.");
    return c.html(codesPage(codes));
  });

  app.post("/logout", (c) => {
    deleteCookie(c, SESSION, { path: "/", secure: config.serverMode });
    return c.redirect("/login");
  });

  // Déconnecte toutes les sessions ouvertes (téléphone, autre navigateur…), y compris celle-ci.
  app.post("/logout-all", requireAuth, (c) => {
    bumpEpoch();
    logEvent(c, "logout_all");
    deleteCookie(c, SESSION, { path: "/", secure: config.serverMode });
    return c.redirect("/login");
  });
}

export function securityStatus() {
  const left = (JSON.parse(getSetting("recovery_codes") ?? "[]") as string[]).length;
  return { serverMode: config.serverMode, twoFactor: twoFactorEnabled(), recoveryCodesLeft: left, passwordHashed: !!config.adminPasswordHash };
}
