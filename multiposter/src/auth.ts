// Authentification à plusieurs utilisateurs :
// - un propriétaire, dont le mot de passe est défini sur le serveur (ADMIN_PASSWORD_HASH) ;
// - des membres invités par lien à usage unique, avec leur propre mot de passe ;
// - double authentification TOTP par personne (obligatoire en mode serveur), codes de secours ;
// - sessions révocables, limitation des tentatives, journal et alertes.
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
import { removeUserData } from "./workspace.ts";

const PUBLIC = resolve(import.meta.dirname, "../public");
const SESSION_DAYS = config.serverMode ? 7 : 30;
/** En HTTPS, préfixe __Host- : cookie lié à cette seule adresse, impossible à injecter depuis un sous-domaine. */
const SESSION = config.serverMode ? "__Host-mp_session" : "mp_session";
const OWNER_NAME = (process.env.ADMIN_NAME ?? "admin").trim().toLowerCase();
/** Identifiant : une adresse e-mail, ou un pseudo (a-z, 0-9, . _ -). 100 caractères maximum. */
const NAME_RE = /^(?=.{2,100}$)[a-z0-9._+-]+(@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,})?$/;
/** Si défini (ex. ptzcorp.fr), les invités doivent choisir une adresse de ce domaine. */
const EMAIL_DOMAIN = process.env.ALLOWED_EMAIL_DOMAIN?.trim().toLowerCase().replace(/^@/, "") || null;

db.exec(`
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS security_events (
  id INTEGER PRIMARY KEY, at INTEGER NOT NULL, type TEXT NOT NULL, ip TEXT, agent TEXT, detail TEXT
);
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  role TEXT NOT NULL,
  password_hash TEXT,
  totp_secret TEXT,
  totp_pending TEXT,
  totp_last INTEGER NOT NULL DEFAULT -1,
  recovery_codes TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL,
  last_login INTEGER
);
CREATE TABLE IF NOT EXISTS invites (token_hash TEXT PRIMARY KEY, created_by INTEGER, expires_at INTEGER NOT NULL);
`);
for (const sql of [
  "ALTER TABLE security_events ADD COLUMN user TEXT",
  "ALTER TABLE invites ADD COLUMN role TEXT NOT NULL DEFAULT 'member'",
  // Lien de réinitialisation du mot de passe d'une personne existante (au lieu d'une invitation).
  "ALTER TABLE invites ADD COLUMN reset_user INTEGER",
]) {
  try {
    db.exec(sql);
  } catch {
    /* colonne déjà présente */
  }
}

const getSetting = (k: string) => (db.prepare("SELECT value FROM settings WHERE key = ?").get(k) as { value: string } | undefined)?.value;
const setSetting = (k: string, v: string) =>
  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value").run(k, v);
const delSetting = (k: string) => db.prepare("DELETE FROM settings WHERE key = ?").run(k);

// ---------- Utilisateurs ----------

interface User {
  id: number;
  name: string;
  /** owner = propriétaire (compte de secours, mot de passe sur le serveur) ; admin = mêmes droits ; member = publication seulement. */
  role: "owner" | "admin" | "member";
  password_hash: string | null;
  totp_secret: string | null;
  totp_pending: string | null;
  totp_last: number;
  recovery_codes: string;
  created_at: number;
  last_login: number | null;
}

const userById = (id: number) => db.prepare("SELECT * FROM users WHERE id = ?").get(id) as User | undefined;
const userByName = (name: string) => db.prepare("SELECT * FROM users WHERE name = ?").get(name.trim().toLowerCase()) as User | undefined;
const owner = () => db.prepare("SELECT * FROM users WHERE role = 'owner'").get() as User | undefined;
/** Identifiant du compte propriétaire. */
export const ownerId = () => owner()!.id;

// Crée le propriétaire au premier démarrage ; reprend la double authentification de l'ancienne
// version mono-utilisateur si elle existait.
if (!owner()) {
  db.prepare(
    "INSERT INTO users (name, role, totp_secret, totp_last, recovery_codes, created_at) VALUES (?, 'owner', ?, ?, ?, ?)",
  ).run(
    OWNER_NAME,
    getSetting("totp_secret") ?? null,
    Number(getSetting("totp_last") ?? -1),
    getSetting("recovery_codes") ?? "[]",
    Date.now(),
  );
  for (const k of ["totp_secret", "totp_pending", "totp_last", "recovery_codes"]) delSetting(k);
} else if (owner()!.name !== OWNER_NAME && !userByName(OWNER_NAME)) {
  db.prepare("UPDATE users SET name = ? WHERE role = 'owner'").run(OWNER_NAME);
}

// Réinitialisation de secours du propriétaire, depuis le serveur uniquement (TWOFA_RESET=1).
if (process.env.TWOFA_RESET === "1") {
  db.prepare("UPDATE users SET totp_secret = NULL, totp_pending = NULL, totp_last = -1, recovery_codes = '[]' WHERE role = 'owner'").run();
  console.log("Double authentification du propriétaire réinitialisée (TWOFA_RESET=1). Retire cette variable maintenant.");
}

// ---------- Mots de passe ----------

const SCRYPT = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

/** Empreinte scrypt au format scrypt:N:r:p:sel:empreinte (base64url). */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 32, SCRYPT);
  return ["scrypt", SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString("base64url"), hash.toString("base64url")].join(":");
}

function checkHash(password: string, stored: string): boolean {
  const [algo, N, r, p, salt, hash] = stored.split(/[:$]/);
  if (algo !== "scrypt" || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const got = scryptSync(password, Buffer.from(salt, "base64url"), expected.length, {
    N: Number(N), r: Number(r), p: Number(p), maxmem: SCRYPT.maxmem,
  });
  return timingSafeEqual(got, expected);
}

const DUMMY_HASH = hashPassword(randomBytes(12).toString("hex"));

function verifyPassword(user: User | undefined, password: string): boolean {
  if (!user) {
    checkHash(password, DUMMY_HASH); // même durée qu'un vrai essai : ne révèle pas si le nom existe
    return false;
  }
  if (user.role === "owner") {
    if (config.adminPasswordHash) return checkHash(password, config.adminPasswordHash);
    const sha = (s: string) => createHash("sha256").update(s).digest();
    return timingSafeEqual(sha(password), sha(config.adminPassword ?? randomBytes(16).toString("hex")));
  }
  return !!user.password_hash && checkHash(password, user.password_hash);
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

/** Vérifie un code (±30 s) et refuse sa réutilisation. Renvoie le compteur accepté, ou null. */
function matchTotp(code: string, secret: string, last: number): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const now = Math.floor(Date.now() / 30_000);
  for (const c of [now - 1, now, now + 1]) {
    if (c <= last) continue;
    if (timingSafeEqual(Buffer.from(totp(secret, c)), Buffer.from(code))) return c;
  }
  return null;
}

const hashCode = (code: string) => createHash("sha256").update(`recovery:${code.toLowerCase().replace(/[^a-z0-9]/g, "")}`).digest("hex");

function newRecoveryCodes(userId: number): string[] {
  const codes = Array.from({ length: 10 }, () => {
    const s = base32(randomBytes(5)).toLowerCase();
    return `${s.slice(0, 4)}-${s.slice(4, 8)}`;
  });
  db.prepare("UPDATE users SET recovery_codes = ? WHERE id = ?").run(JSON.stringify(codes.map(hashCode)), userId);
  return codes;
}

function useRecoveryCode(user: User, code: string): boolean {
  const list: string[] = JSON.parse(user.recovery_codes || "[]");
  const i = list.indexOf(hashCode(code));
  if (i < 0) return false;
  list.splice(i, 1);
  db.prepare("UPDATE users SET recovery_codes = ? WHERE id = ?").run(JSON.stringify(list), user.id);
  return true;
}

const anyTwoFactor = () => !!db.prepare("SELECT 1 FROM users WHERE totp_secret IS NOT NULL").get();
export const twoFactorEnabled = anyTwoFactor;

// ---------- Journal et limitation ----------

export function clientIp(c: Context): string {
  // Derrière le proxy d'alwaysdata (TRUST_PROXY=1) : la dernière adresse ajoutée par le proxy est la vraie.
  if (process.env.TRUST_PROXY === "1") {
    const xff = c.req.header("x-forwarded-for")?.split(",").map((s) => s.trim()).filter(Boolean);
    if (xff?.length) return xff[xff.length - 1];
  }
  return "local";
}

function logEvent(c: Context | null, type: string, user: string | null, detail = "") {
  db.prepare("INSERT INTO security_events (at, type, ip, agent, detail, user) VALUES (?, ?, ?, ?, ?, ?)").run(
    Date.now(), type, c ? clientIp(c) : null, c ? (c.req.header("user-agent") ?? "").slice(0, 200) : null, detail.slice(0, 300), user,
  );
  db.prepare("DELETE FROM security_events WHERE id NOT IN (SELECT id FROM security_events ORDER BY id DESC LIMIT 500)").run();
}

export function securityEvents(limit = 50) {
  return db.prepare("SELECT at, type, ip, agent, detail, user FROM security_events ORDER BY id DESC LIMIT ?").all(limit);
}

const failures = new Map<string, { count: number; until: number }>();
let globalFailures: number[] = [];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------- Sessions ----------

// Contenu : expiration . époque . utilisateur . empreinte des identifiants . étape
// (f = complète, e = activation de la 2FA). Changer de mot de passe, retirer l'utilisateur,
// activer ou réinitialiser sa 2FA, ou « Déconnecter tous les appareils » ferme ses sessions.
function fingerprint(u: User): string {
  const cred = u.role === "owner" ? (config.adminPasswordHash ?? config.adminPassword) : u.password_hash;
  return createHash("sha256").update(`session:${u.id}:${cred}:${u.totp_secret ?? ""}:${config.appSecret}`).digest("hex").slice(0, 24);
}
const sessionEpoch = () => getSetting("session_epoch") ?? "0";
const bumpEpoch = () => setSetting("session_epoch", String(Number(sessionEpoch()) + 1));

const needs2fa = (u: User) => config.serverMode && !u.totp_secret;

async function session(c: Context): Promise<{ user: User; stage: "f" | "e" } | null> {
  const v = await getSignedCookie(c, config.appSecret, SESSION);
  if (!v) return null;
  const [exp, epoch, uid, fp, stage] = v.split(".");
  const user = userById(Number(uid));
  if (!user || !(Number(exp) > Date.now() && epoch === sessionEpoch() && fp === fingerprint(user))) return null;
  if (stage === "f") return needs2fa(user) ? null : { user, stage: "f" };
  return stage === "e" ? { user, stage: "e" } : null;
}

async function openSession(c: Context, user: User, stage: "f" | "e") {
  const ttl = stage === "e" ? 15 * 60_000 : SESSION_DAYS * 86_400_000;
  await setSignedCookie(c, SESSION, `${Date.now() + ttl}.${sessionEpoch()}.${user.id}.${fingerprint(user)}.${stage}`, config.appSecret, {
    httpOnly: true,
    secure: config.serverMode || !/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(c.req.header("host") ?? ""),
    sameSite: "Lax",
    path: "/",
    maxAge: ttl / 1000,
  });
}

const current = new WeakMap<Request, User>();
/** Utilisateur connecté (après requireAuth). */
export const currentUser = (c: Context) => current.get(c.req.raw);

export async function isLogged(c: Context) {
  const s = await session(c);
  if (s?.stage !== "f") return false;
  current.set(c.req.raw, s.user);
  return true;
}

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
<meta name="robots" content="noindex"><title>${esc(title)} · PTZ Posting</title><link rel="icon" href="/assets/logo.png">
<link rel="stylesheet" href="/assets/styles.css"></head><body class="login"><main class="card login-card wide">${body}</main><script src="/assets/pages.js"></script></body></html>`;
}

function setupPage(user: User, secret: string, error = "") {
  const label = encodeURIComponent(`PTZ Posting (${user.name})`);
  const uri = `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent("PTZ Posting")}&digits=6&period=30`;
  const qr = qrcode(0, "M");
  qr.addData(uri);
  qr.make();
  const svg = qr.createSvgTag({ cellSize: 5, margin: 3, scalable: true });
  return page("Double authentification", `
<img src="/assets/logo.png" alt="" width="84" height="84">
<h1>Double authentification</h1>
<p class="muted">Compte <strong>${esc(user.name)}</strong>. Obligatoire pour protéger l'app : il te faudra ton téléphone à chaque connexion.</p>
<ol class="steps">
  <li>Installe <strong>Google Authenticator</strong> (ou Microsoft Authenticator, 2FAS…) sur ton téléphone.</li>
  <li>Dans l'appli, ajoute un compte en <strong>scannant ce QR code</strong> :</li>
</ol>
<div class="otp-phone">
  <p><strong>Tu es sur ton téléphone ?</strong> Pas besoin de scanner : touche ce bouton, ton appli d'authentification s'ouvre et ajoute PTZ Posting toute seule. Reviens ensuite ici pour taper le code.</p>
  <a class="btn primary" href="${esc(uri)}">Ajouter à mon appli d'authentification</a>
  <p class="muted small">Rien ne s'ouvre ? Dans l'appli, choisis « Saisir une clé de configuration » et colle la clé ci-dessous (bouton Copier).</p>
</div>
<div class="qr">${svg}</div>
<p class="muted small">Impossible de scanner ? Choisis « Saisir une clé » et tape : <code class="key">${esc(secret.match(/.{1,4}/g)!.join(" "))}</code></p>
<button class="btn ghost small copy-key" type="button" data-key="${esc(secret)}">Copier la clé</button>
<form method="post" action="/2fa/setup">
  <label for="code">3. Tape le code à 6 chiffres affiché par l'appli</label>
  <input id="code" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="\\d{6}" maxlength="6" required autofocus>
  ${error ? `<p class="error">${esc(error)}</p>` : ""}
  <button class="btn primary" type="submit">Activer</button>
</form>
<form method="post" action="/2fa/setup/new">
  <button class="btn ghost small" type="submit">Générer un nouveau QR code</button>
  <p class="muted small">À utiliser si ce QR code ou sa clé ont été vus par quelqu'un d'autre (capture d'écran partagée, par exemple).</p>
</form>`);
}

function codesPage(codes: string[]) {
  return page("Codes de secours", `
<h1>Codes de secours</h1>
<p>La double authentification est activée. Voici <strong>10 codes de secours</strong> : chacun remplace une fois le code du téléphone, si tu le perds.</p>
<p class="error"><strong>Note-les maintenant</strong> dans un endroit sûr (gestionnaire de mots de passe, papier) : ils ne seront plus jamais affichés.</p>
<ul class="codes">${codes.map((c) => `<li><code>${c}</code></li>`).join("")}</ul>
<a class="btn primary" href="/?bienvenue=1">J'ai noté mes codes, ouvrir l'app</a>`);
}

function invitePage(error = "") {
  return page("Invitation", `
<img src="/assets/logo.png" alt="" width="84" height="84">
<h1>Rejoindre PTZ Posting</h1>
<p class="muted">Choisis ton identifiant et ton mot de passe. Tu activeras ensuite la double authentification sur ton téléphone.</p>
<form method="post">
  <label for="name">${EMAIL_DOMAIN ? `Ton adresse e-mail @${esc(EMAIL_DOMAIN)}` : "Identifiant (ton adresse e-mail, ou un pseudo)"}</label>
  <input id="name" name="name" type="${EMAIL_DOMAIN ? "email" : "text"}" autocomplete="username" maxlength="100" required autofocus>
  <label for="password">Mot de passe (12 caractères minimum)</label>
  <input id="password" name="password" type="password" autocomplete="new-password" minlength="12" required>
  <label for="password2">Confirme le mot de passe</label>
  <input id="password2" name="password2" type="password" autocomplete="new-password" minlength="12" required>
  ${error ? `<p class="error">${esc(error)}</p>` : ""}
  <button class="btn primary" type="submit">Créer mon accès</button>
</form>`);
}

const tokenHash = (t: string) => createHash("sha256").update(`invite:${t}`).digest("hex");
const validInvite = (t: string) =>
  db.prepare("SELECT token_hash, role, reset_user FROM invites WHERE token_hash = ? AND expires_at > ?").get(tokenHash(t), Date.now()) as
    | { token_hash: string; role: string; reset_user: number | null }
    | undefined;

function resetPage(name: string, error = "") {
  return page("Nouveau mot de passe", `
<img src="/assets/logo.png" alt="" width="84" height="84">
<h1>Nouveau mot de passe</h1>
<p class="muted">Compte <strong>${esc(name)}</strong>. Tes réseaux, tes posts et ta double authentification sont conservés.</p>
<form method="post">
  <label for="password">Nouveau mot de passe (12 caractères minimum)</label>
  <input id="password" name="password" type="password" autocomplete="new-password" minlength="12" required autofocus>
  <label for="password2">Confirme le mot de passe</label>
  <input id="password2" name="password2" type="password" autocomplete="new-password" minlength="12" required>
  ${error ? `<p class="error">${esc(error)}</p>` : ""}
  <button class="btn primary" type="submit">Enregistrer</button>
</form>`);
}

// ---------- Routes ----------

export function registerAuth(app: Hono) {
  app.get("/login", async (c) => c.html(await readFile(resolve(PUBLIC, "login.html"), "utf8")));
  // Aide accessible à tous, même avant de se connecter (aucune donnée personnelle dedans).
  app.get("/aide", async (c) => c.html(await readFile(resolve(PUBLIC, "aide.html"), "utf8")));
  // Pages publiques exigées par Meta, Google et TikTok pour déclarer l'app.
  app.get("/confidentialite", (c) => c.html(page("Confidentialité", `
<h1>Politique de confidentialité</h1>
<p>PTZ Posting est un outil interne de PTZ Corp qui permet à ses membres de publier leurs propres contenus sur leurs réseaux sociaux. Il n'est ni vendu ni ouvert au public.</p>
<h2>Données traitées</h2>
<ul>
<li>Pour chaque membre : son adresse e-mail professionnelle, son mot de passe (sous forme chiffrée irréversible) et le journal de ses connexions.</li>
<li>Pour chaque réseau connecté par un membre (Facebook, Instagram, Threads, YouTube, TikTok, X, Canva) : le nom et l'identifiant du compte, et les jetons d'accès, chiffrés, servant uniquement à publier les posts que ce membre a programmés ou à importer ses designs Canva.</li>
<li>Les textes, images et vidéos que le membre ajoute à ses posts.</li>
</ul>
<h2>Utilisation</h2>
<p>Ces données servent uniquement à publier les contenus demandés par le membre, au moment qu'il a choisi. Elles ne sont ni vendues, ni partagées, ni utilisées pour de la publicité ou de l'analyse. Chaque membre ne voit que ses propres données.</p>
<h2>Suppression des données</h2>
<p>Un membre peut à tout moment déconnecter un réseau (onglet Comptes → Déconnecter) : ses jetons d'accès sont alors supprimés. Il peut aussi retirer l'accès de l'app depuis les paramètres du réseau concerné. Sur demande à un administrateur de PTZ Corp, l'accès du membre et toutes ses données (réseaux, posts, médias) sont supprimés définitivement.</p>
<p><a class="btn ghost" href="/aide">Aide</a></p>`)));
  app.get("/conditions", (c) => c.html(page("Conditions d'utilisation", `
<h1>Conditions d'utilisation</h1>
<p>PTZ Posting est réservé aux membres invités par PTZ Corp. Chaque membre publie sous sa propre responsabilité, sur ses propres comptes, et s'engage à respecter les règles de chaque réseau social.</p>
<p>L'accès est personnel : identifiants et double authentification ne doivent pas être partagés. PTZ Corp peut retirer un accès à tout moment.</p>
<p>L'outil est fourni tel quel, sans garantie de disponibilité. Voir aussi la <a href="/confidentialite">politique de confidentialité</a>.</p>`)));
  app.get("/login/info", (c) => c.json({ twoFactor: config.serverMode || anyTwoFactor(), nameRequired: config.serverMode }));

  app.post("/login", async (c) => {
    const ip = clientIp(c);
    const f = failures.get(ip);
    if (f && f.until > Date.now()) return c.redirect("/login?e=wait");
    // Attaque massive (beaucoup d'échecs, toutes adresses confondues) : on ralentit chaque essai.
    globalFailures = globalFailures.filter((t) => t > Date.now() - 3_600_000);
    if (globalFailures.length > 20) await sleep(3_000);

    const body = await c.req.parseBody();
    // Identifiant vide = propriétaire, seulement sur ton PC : en ligne, l'identifiant est obligatoire.
    const name = String(body.name ?? "").trim().toLowerCase() || (config.serverMode ? "" : OWNER_NAME);
    const password = String(body.password ?? "");
    const code = String(body.code ?? "").trim();
    const user = userByName(name);
    let ok = verifyPassword(user, password);
    let usedRecovery = false;
    if (ok && user!.totp_secret) {
      const counter = matchTotp(code, unseal(user!.totp_secret)!, user!.totp_last);
      if (counter !== null) db.prepare("UPDATE users SET totp_last = ? WHERE id = ?").run(counter, user!.id);
      ok = counter !== null;
      if (!ok && /^[a-z0-9]{4}-?[a-z0-9]{4}$/i.test(code)) ok = usedRecovery = useRecoveryCode(user!, code);
    }
    if (!ok) {
      const count = (f?.count ?? 0) + 1;
      const locked = count >= 5;
      failures.set(ip, { count, until: locked ? Date.now() + 15 * 60_000 : 0 });
      globalFailures.push(Date.now());
      logEvent(c, "login_fail", user ? user.name : null, `${locked ? "adresse bloquée 15 min · " : ""}identifiant « ${name.slice(0, 100)} »`);
      if (locked) void alert(`🚨 PTZ Posting : 5 échecs de connexion depuis ${ip}, adresse bloquée 15 min.`);
      if (globalFailures.length === 21) void alert("🚨 PTZ Posting : plus de 20 échecs de connexion en 1 h. Les essais sont ralentis.");
      // Même message pour un identifiant, un mot de passe ou un code faux : on ne révèle rien.
      return c.redirect("/login?e=1");
    }
    failures.delete(ip);
    const u = userById(user!.id)!;

    if (needs2fa(u)) {
      await openSession(c, u, "e");
      logEvent(c, "login_setup", u.name, "activation de la double authentification");
      return c.redirect("/2fa/setup");
    }
    await openSession(c, u, "f");
    db.prepare("UPDATE users SET last_login = ? WHERE id = ?").run(Date.now(), u.id);
    logEvent(c, "login_ok", u.name, usedRecovery ? "avec un code de secours" : "");
    void alert(
      `🔐 Connexion de « ${u.name} » à PTZ Posting depuis ${ip}${usedRecovery ? " avec un CODE DE SECOURS" : ""} (${(c.req.header("user-agent") ?? "").slice(0, 80)}). Si ce n'est pas normal : « Déconnecter tous les appareils » dans l'onglet Comptes.`,
    );
    return c.redirect("/?bienvenue=1"); // l'app joue le son de connexion
  });

  // Activation de la double authentification de l'utilisateur de la session.
  const setupUser = async (c: Context) => {
    const s = await session(c);
    return s && !s.user.totp_secret ? s.user : null;
  };

  app.get("/2fa/setup", async (c) => {
    const user = await setupUser(c);
    if (!user) return c.redirect("/login");
    let secret = unseal(user.totp_pending);
    if (!secret) {
      secret = base32(randomBytes(20));
      db.prepare("UPDATE users SET totp_pending = ? WHERE id = ?").run(seal(secret), user.id);
    }
    return c.html(setupPage(user, secret));
  });

  // Remplace le secret en attente (pas encore activé) par un nouveau.
  app.post("/2fa/setup/new", async (c) => {
    const user = await setupUser(c);
    if (!user) return c.redirect("/login");
    db.prepare("UPDATE users SET totp_pending = ? WHERE id = ?").run(seal(base32(randomBytes(20))), user.id);
    logEvent(c, "2fa_new_secret", user.name);
    return c.redirect("/2fa/setup");
  });

  app.post("/2fa/setup", async (c) => {
    const user = await setupUser(c);
    if (!user) return c.redirect("/login");
    const secret = unseal(user.totp_pending);
    const code = String((await c.req.parseBody()).code ?? "").trim();
    if (!secret) return c.redirect("/2fa/setup");
    const counter = matchTotp(code, secret, -1);
    if (counter === null) return c.html(setupPage(user, secret, "Code incorrect. Vérifie l'heure de ton téléphone et réessaie."), 400);
    db.prepare("UPDATE users SET totp_secret = ?, totp_pending = NULL, totp_last = ? WHERE id = ?").run(seal(secret), counter, user.id);
    const codes = newRecoveryCodes(user.id);
    const updated = userById(user.id)!;
    await openSession(c, updated, "f"); // les autres sessions de cet utilisateur sont fermées (empreinte changée)
    db.prepare("UPDATE users SET last_login = ? WHERE id = ?").run(Date.now(), user.id);
    logEvent(c, "2fa_enabled", user.name);
    void alert(`🔐 Double authentification activée pour « ${user.name} » sur PTZ Posting.`);
    return c.html(codesPage(codes));
  });

  // Invitation : création d'un accès membre avec un lien à usage unique.
  app.get("/invite/:token{[A-Za-z0-9_-]{20,100}}", (c) => {
    const inv = validInvite(c.req.param("token"));
    if (!inv) return c.html(page("Invitation", "<h1>Lien expiré</h1><p>Ce lien n'est plus valable. Demande-en un nouveau.</p>"), 404);
    if (inv.reset_user) {
      const u = userById(inv.reset_user);
      return u ? c.html(resetPage(u.name)) : c.html(page("Lien", "<h1>Compte introuvable</h1>"), 404);
    }
    return c.html(invitePage());
  });

  app.post("/invite/:token{[A-Za-z0-9_-]{20,100}}", async (c) => {
    const token = c.req.param("token");
    const inv = validInvite(token);
    if (!inv) return c.html(page("Invitation", "<h1>Lien expiré</h1><p>Ce lien n'est plus valable. Demande-en un nouveau.</p>"), 404);
    const b = await c.req.parseBody();
    if (inv.reset_user) {
      // Réinitialisation : nouveau mot de passe, le reste du compte est conservé.
      const u = userById(inv.reset_user);
      if (!u) return c.html(page("Lien", "<h1>Compte introuvable</h1>"), 404);
      const pw = String(b.password ?? "");
      if (pw.length < 12) return c.html(resetPage(u.name, "Mot de passe trop court (12 caractères minimum)."), 400);
      if (pw !== String(b.password2 ?? "")) return c.html(resetPage(u.name, "Les deux mots de passe ne correspondent pas."), 400);
      const del = db.prepare("DELETE FROM invites WHERE token_hash = ?").run(tokenHash(token));
      if (!del.changes) return c.html(page("Lien", "<h1>Lien déjà utilisé</h1>"), 409);
      db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(pw), u.id); // ferme ses anciennes sessions
      logEvent(c, "password_reset", u.name);
      void alert(`🔑 Mot de passe de « ${u.name} » réinitialisé sur PTZ Posting.`);
      return c.html(page("Mot de passe changé", `<h1>Mot de passe changé</h1><p>Tu peux te connecter avec ton nouveau mot de passe et le code de ton téléphone.</p><a class="btn primary" href="/login">Se connecter</a>`));
    }
    const name = String(b.name ?? "").trim().toLowerCase();
    const password = String(b.password ?? "");
    if (!NAME_RE.test(name)) return c.html(invitePage("Identifiant invalide : une adresse e-mail, ou un pseudo (a-z, 0-9, point, tiret, tiret bas)."), 400);
    if (EMAIL_DOMAIN && !name.endsWith(`@${EMAIL_DOMAIN}`)) return c.html(invitePage(`Utilise ton adresse e-mail @${EMAIL_DOMAIN}.`), 400);
    if (userByName(name)) return c.html(invitePage("Cet identifiant est déjà pris."), 400);
    if (password.length < 12) return c.html(invitePage("Mot de passe trop court (12 caractères minimum)."), 400);
    if (password !== String(b.password2 ?? "")) return c.html(invitePage("Les deux mots de passe ne correspondent pas."), 400);
    // Le lien ne sert qu'une fois : supprimé avant la création du compte.
    const role = validInvite(token)?.role === "admin" ? "admin" : "member";
    const del = db.prepare("DELETE FROM invites WHERE token_hash = ?").run(tokenHash(token));
    if (!del.changes) return c.html(page("Invitation", "<h1>Lien déjà utilisé</h1>"), 409);
    const id = Number(
      db.prepare("INSERT INTO users (name, role, password_hash, created_at) VALUES (?, ?, ?, ?)").run(name, role, hashPassword(password), Date.now())
        .lastInsertRowid,
    );
    const user = userById(id)!;
    logEvent(c, "user_created", name, `via une invitation (${role === "admin" ? "administrateur" : "membre"})`);
    void alert(`👤 Nouvel utilisateur « ${name} » (${role === "admin" ? "administrateur" : "membre"}) créé sur PTZ Posting via une invitation.`);
    if (needs2fa(user)) {
      await openSession(c, user, "e");
      return c.redirect("/2fa/setup");
    }
    await openSession(c, user, "f");
    return c.redirect("/?bienvenue=1");
  });

  app.post("/logout", (c) => {
    deleteCookie(c, SESSION, { path: "/", secure: config.serverMode });
    return c.redirect("/login");
  });

  // Déconnecte toutes les sessions de tout le monde (téléphones, autres navigateurs…), y compris celle-ci.
  app.post("/logout-all", requireAuth, (c) => {
    bumpEpoch();
    logEvent(c, "logout_all", currentUser(c)?.name ?? null);
    deleteCookie(c, SESSION, { path: "/", secure: config.serverMode });
    return c.redirect("/login");
  });
}

// ---------- API (montée sous /api, déjà protégée par requireAuth) ----------

export function registerUserApi(api: Hono) {
  const isAdmin = (u?: User) => u?.role === "owner" || u?.role === "admin";
  const ownerOnly = (c: Context) => (isAdmin(currentUser(c)) ? null : c.json({ error: "Réservé aux administrateurs." }, 403));

  api.get("/me", (c) => {
    const u = currentUser(c)!;
    return c.json({ name: u.name, role: u.role });
  });

  api.get("/users", (c) =>
    c.json(
      (db.prepare("SELECT * FROM users ORDER BY role DESC, name").all() as unknown as User[]).map((u) => ({
        id: u.id,
        name: u.name,
        role: u.role,
        twoFactor: !!u.totp_secret,
        recoveryCodesLeft: (JSON.parse(u.recovery_codes || "[]") as string[]).length,
        lastLogin: u.last_login,
        createdAt: u.created_at,
      })),
    ),
  );

  api.post("/users/invite", (c) => {
    const denied = ownerOnly(c);
    if (denied) return denied;
    const role = c.req.query("role") === "admin" ? "admin" : "member";
    const token = randomBytes(32).toString("base64url");
    const expiresAt = Date.now() + 48 * 3_600_000;
    db.prepare("DELETE FROM invites WHERE expires_at < ?").run(Date.now());
    db.prepare("INSERT INTO invites (token_hash, created_by, expires_at, role) VALUES (?, ?, ?, ?)").run(tokenHash(token), currentUser(c)!.id, expiresAt, role);
    logEvent(c, "invite_created", currentUser(c)!.name, role === "admin" ? "administrateur" : "membre");
    return c.json({ link: `${config.appUrl}/invite/${token}`, expiresAt });
  });

  api.delete("/users/:id", (c) => {
    const denied = ownerOnly(c);
    if (denied) return denied;
    const u = userById(Number(c.req.param("id")));
    if (!u || u.role === "owner" || u.id === currentUser(c)!.id) return c.json({ error: "Impossible de retirer ce compte." }, 400);
    db.prepare("DELETE FROM users WHERE id = ?").run(u.id); // ses sessions deviennent invalides
    removeUserData(u.id); // et tout son espace : réseaux, posts, Canva, règles
    logEvent(c, "user_removed", currentUser(c)!.name, `« ${u.name} » retiré`);
    void alert(`👤 L'accès de « ${u.name} » à PTZ Posting a été retiré, ainsi que son espace (réseaux, posts, Canva).`);
    return c.json({ ok: true });
  });

  api.post("/users/:id/reset-password", (c) => {
    const denied = ownerOnly(c);
    if (denied) return denied;
    const u = userById(Number(c.req.param("id")));
    if (!u || u.role === "owner") return c.json({ error: "Le mot de passe du propriétaire se change sur le serveur (ADMIN_PASSWORD_HASH)." }, 400);
    const token = randomBytes(32).toString("base64url");
    const expiresAt = Date.now() + 48 * 3_600_000;
    db.prepare("DELETE FROM invites WHERE reset_user = ?").run(u.id); // un seul lien valable à la fois
    db.prepare("INSERT INTO invites (token_hash, created_by, expires_at, role, reset_user) VALUES (?, ?, ?, ?, ?)").run(
      tokenHash(token), currentUser(c)!.id, expiresAt, u.role, u.id,
    );
    logEvent(c, "reset_link_created", currentUser(c)!.name, `pour « ${u.name} »`);
    return c.json({ link: `${config.appUrl}/invite/${token}`, expiresAt });
  });

  api.post("/users/:id/reset-2fa", (c) => {
    const denied = ownerOnly(c);
    if (denied) return denied;
    const u = userById(Number(c.req.param("id")));
    if (!u || u.role === "owner") return c.json({ error: "Pour le propriétaire, utilise TWOFA_RESET=1 sur le serveur." }, 400);
    if (u.id === currentUser(c)!.id) return c.json({ error: "Demande à un autre administrateur de réinitialiser ta double authentification." }, 400);
    db.prepare("UPDATE users SET totp_secret = NULL, totp_pending = NULL, totp_last = -1, recovery_codes = '[]' WHERE id = ?").run(u.id);
    logEvent(c, "2fa_reset", currentUser(c)!.name, `pour « ${u.name} »`);
    void alert(`🔐 Double authentification de « ${u.name} » réinitialisée : à réactiver à sa prochaine connexion.`);
    return c.json({ ok: true });
  });
}

export function securityStatus(c: Context) {
  const u = currentUser(c)!;
  return {
    serverMode: config.serverMode,
    user: u.name,
    role: u.role,
    twoFactor: !!u.totp_secret,
    recoveryCodesLeft: (JSON.parse(u.recovery_codes || "[]") as string[]).length,
    passwordHashed: u.role === "owner" ? !!config.adminPasswordHash : true,
  };
}
