import { spawn } from "node:child_process";
import { createReadStream, existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Readable } from "node:stream";
import { timingSafeEqual, createHash } from "node:crypto";

import { serve } from "@hono/node-server";
import { Hono, type Context, type Next } from "hono";
import { deleteCookie, getSignedCookie, setSignedCookie } from "hono/cookie";

import { config, mediaDir } from "./config.ts";
import { pkcePair, randomId } from "./crypto.ts";
import { db, deleteAccount, getAccount, listAccounts, upsertAccount } from "./db.ts";
import { getMediaList, saveUpload } from "./media.ts";
import { flows, publishers } from "./providers/index.ts";
import { canvaApi, canvaRoutes, startCanvaWatcher } from "./canva.ts";
import { autostartStatus, setAutostart } from "./autostart.ts";
import { startCleanup } from "./cleanup.ts";
import { publishPost, rollupStatus, startScheduler } from "./scheduler.ts";

const app = new Hono();
const PUBLIC = resolve(import.meta.dirname, "../public");
const SESSION = "mp_session";
const SESSION_DAYS = 30;
/** Cookie « Secure » sauf en accès local (http://127.0.0.1), où le navigateur le refuserait. */
const isLocalRequest = (c: Context) => /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(c.req.header("host") ?? "");

// Adresses par lesquelles l'app accepte d'être appelée. Bloque le « DNS rebinding » : un site
// malveillant ouvert dans ton navigateur ne peut pas se faire passer pour 127.0.0.1.
const allowedHosts = new Set(
  [
    "localhost",
    "127.0.0.1",
    "[::1]",
    new URL(config.publicUrl).hostname,
    ...(process.env.ALLOWED_HOSTS ?? "").split(",").map((h) => h.trim().toLowerCase()),
  ].filter(Boolean),
);
const hostOf = (c: Context) => (c.req.header("host") ?? "").toLowerCase().replace(/:\d+$/, "");

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
].join("; ");

app.use("*", async (c, next) => {
  if (!allowedHosts.has(hostOf(c))) return c.text("Adresse non autorisée", 421);
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Referrer-Policy", "no-referrer");
  c.header("X-Frame-Options", "DENY");
  c.header("Cross-Origin-Opener-Policy", "same-origin");
  c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if ((c.res.headers.get("content-type") ?? "").startsWith("text/html")) c.header("Content-Security-Policy", CSP);
});

// ---------- Authentification (mot de passe unique) ----------

// La session contient : expiration . « époque » . empreinte du mot de passe.
// Changer le mot de passe, ou cliquer « Déconnecter tous les appareils » (époque +1),
// invalide toutes les sessions existantes.
const passwordFingerprint = createHash("sha256").update(`session:${config.adminPassword}:${config.appSecret}`).digest("hex").slice(0, 24);
db.exec("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
const sessionEpoch = () =>
  (db.prepare("SELECT value FROM settings WHERE key = 'session_epoch'").get() as { value: string } | undefined)?.value ?? "0";

async function isLogged(c: Context): Promise<boolean> {
  const v = await getSignedCookie(c, config.appSecret, SESSION);
  if (!v) return false;
  const [exp, epoch, fp] = v.split(".");
  return Number(exp) > Date.now() && epoch === sessionEpoch() && fp === passwordFingerprint;
}

async function requireAuth(c: Context, next: Next) {
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

const failedLogins = new Map<string, { count: number; until: number }>();
const sha = (s: string) => createHash("sha256").update(s).digest();

// Le lanceur Windows ouvre /open : on renvoie vers l'adresse publique quand il y en a une,
// pour que les connexions aux réseaux se fassent sur la bonne adresse.
app.get("/open", (c) => c.redirect(`${config.publicUrl}/`));

app.get("/login", async (c) => c.html(await readFile(resolve(PUBLIC, "login.html"), "utf8")));

app.post("/login", async (c) => {
  // X-Forwarded-For n'est pris en compte que derrière un proxy de confiance (TRUST_PROXY=1).
  const ip = (process.env.TRUST_PROXY === "1" && c.req.header("x-forwarded-for")?.split(",")[0].trim()) || "local";
  const f = failedLogins.get(ip);
  if (f && f.until > Date.now()) return c.redirect("/login?e=wait");
  const body = await c.req.parseBody();
  const ok = timingSafeEqual(sha(String(body.password ?? "")), sha(config.adminPassword));
  if (!ok) {
    const count = (f?.count ?? 0) + 1;
    failedLogins.set(ip, { count, until: count >= 5 ? Date.now() + 15 * 60_000 : 0 });
    return c.redirect("/login?e=1");
  }
  failedLogins.delete(ip);
  const value = `${Date.now() + SESSION_DAYS * 86_400_000}.${sessionEpoch()}.${passwordFingerprint}`;
  await setSignedCookie(c, SESSION, value, config.appSecret, {
    httpOnly: true,
    secure: !isLocalRequest(c),
    sameSite: "Lax",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
  return c.redirect("/");
});

app.post("/logout", (c) => {
  deleteCookie(c, SESSION, { path: "/" });
  return c.redirect("/login");
});

// Déconnecte toutes les sessions ouvertes (téléphone, autre navigateur…), y compris celle-ci.
app.post("/logout-all", requireAuth, (c) => {
  const next = String(Number(sessionEpoch()) + 1);
  db.prepare("INSERT INTO settings (key, value) VALUES ('session_epoch', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value").run(next);
  deleteCookie(c, SESSION, { path: "/" });
  return c.redirect("/login");
});

// ---------- Fichiers publics ----------

const MIME: Record<string, string> = {
  html: "text/html; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
};

function sendFile(c: Context, path: string, cache = "no-cache") {
  if (!existsSync(path)) return c.notFound();
  const { size } = statSync(path);
  const type = MIME[path.split(".").pop()!] ?? "application/octet-stream";
  const range = c.req.header("range")?.match(/bytes=(\d*)-(\d*)/);
  if (range && (range[1] || range[2])) {
    const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start > end || start >= size) return c.body(null, 416, { "Content-Range": `bytes */${size}` });
    return c.body(Readable.toWeb(createReadStream(path, { start, end })) as ReadableStream, 206, {
      "Content-Type": type,
      "Content-Length": String(end - start + 1),
      "Content-Range": `bytes ${start}-${end}/${size}`,
      "Accept-Ranges": "bytes",
      "Cache-Control": cache,
    });
  }
  return c.body(Readable.toWeb(createReadStream(path)) as ReadableStream, 200, {
    "Content-Type": type,
    "Content-Length": String(size),
    "Accept-Ranges": "bytes",
    "Cache-Control": cache,
  });
}

// Médias : publics car Instagram, Facebook et Threads viennent les télécharger.
// Les noms sont aléatoires (144 bits) donc non devinables.
app.get("/media/:file{[A-Za-z0-9_-]+\\.[a-z0-9]+}", (c) =>
  sendFile(c, resolve(mediaDir, c.req.param("file")), "public, max-age=86400"),
);

app.get("/assets/:file{[a-z0-9-]+\\.(css|js|svg|png)}", (c) => sendFile(c, resolve(PUBLIC, c.req.param("file"))));

// ---------- OAuth ----------

app.use("/oauth/canva/start", requireAuth);
app.route("/", canvaRoutes);

app.get("/oauth/:flow/start", requireAuth, (c) => {
  const flow = flows[c.req.param("flow") ?? ""] as (typeof flows)[string] | undefined;
  if (!flow?.configured()) return c.text("Réseau non configuré (voir .env)", 400);
  const state = randomId(24);
  const { verifier, challenge } = pkcePair();
  db.prepare("INSERT INTO oauth_states (state, provider, verifier, created_at) VALUES (?, ?, ?, ?)").run(
    state,
    flow.id,
    flow.usesPkce ? verifier : null,
    Date.now(),
  );
  return c.redirect(flow.authorizeUrl(state, challenge));
});

// Pas de requireAuth ici : le retour arrive sur l'adresse publique, qui peut ne pas avoir la
// session (connexion faite depuis http://127.0.0.1). Le « state » à usage unique, créé par une
// session connectée, suffit à authentifier le retour.
app.get("/oauth/:flow/callback", async (c) => {
  const flow = flows[c.req.param("flow") ?? ""] as (typeof flows)[string] | undefined;
  const { state, code, error, error_description } = c.req.query();
  db.prepare("DELETE FROM oauth_states WHERE created_at < ?").run(Date.now() - 15 * 60_000);
  const row = db.prepare("DELETE FROM oauth_states WHERE state = ? RETURNING provider, verifier").get(state ?? "") as
    | { provider: string; verifier: string | null }
    | undefined;
  const back = (msg: string, ok = false) => c.redirect(`/#accounts?${ok ? "ok" : "err"}=${encodeURIComponent(msg)}`);
  if (!flow || !row || row.provider !== flow.id) return back("Lien de connexion expiré, recommence.");
  if (error || !code) return back(`Connexion annulée : ${error_description ?? error ?? "pas de code"}`);
  try {
    const accounts = await flow.callback(code, row.verifier);
    accounts.forEach(upsertAccount);
    return back(`${accounts.length} compte(s) connecté(s) : ${accounts.map((a) => a.name).join(", ")}`, true);
  } catch (e) {
    console.error(`[oauth ${flow.id}]`, e);
    return back(e instanceof Error ? e.message : "Échec de la connexion");
  }
});

// ---------- API ----------

const api = new Hono();
api.use("*", requireAuth);

api.get("/meta", (c) =>
  c.json({
    timezone: config.timezone,
    flows: Object.values(flows).map((f) => ({ id: f.id, label: f.label, providers: f.providers, configured: f.configured() })),
    publishers: Object.values(publishers).map((p) => ({ id: p.id, label: p.label, maxText: p.maxText })),
  }),
);

api.get("/system", (c) => c.json({ autostart: autostartStatus() }));

api.put("/system/autostart", async (c) => {
  const { enabled } = await c.req.json<{ enabled?: boolean }>();
  try {
    return c.json({ autostart: await setAutostart(!!enabled) });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : "Réglage impossible" }, 400);
  }
});

api.get("/accounts", (c) =>
  c.json(
    listAccounts().map((a) => ({
      id: a.id,
      provider: a.provider,
      name: a.name,
      avatarUrl: a.avatarUrl,
      expiresAt: a.expiresAt,
      canRefresh: !!a.refreshToken || a.provider === "threads",
    })),
  ),
);

api.delete("/accounts/:id", (c) => {
  deleteAccount(Number(c.req.param("id")));
  return c.json({ ok: true });
});

api.put("/media", async (c) => {
  const mime = (c.req.header("content-type") ?? "").split(";")[0].trim();
  const filename = c.req.query("filename") ?? "fichier";
  if (!c.req.raw.body) return c.json({ error: "Corps vide" }, 400);
  try {
    const m = await saveUpload(c.req.raw.body, filename, mime);
    return c.json({ id: m.id, filename: m.filename, mime: m.mime, size: m.size, kind: m.kind, url: `/media/${m.publicUrl.split("/").pop()}` });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : "Upload impossible" }, 400);
  }
});

function serializePost(p: Record<string, any>) {
  const targets = db
    .prepare(
      `SELECT t.id, t.account_id, t.text_override, t.status, t.external_url, t.error, t.attempts, t.published_at,
              a.provider, a.name, a.avatar_url
       FROM post_targets t LEFT JOIN accounts a ON a.id = t.account_id WHERE t.post_id = ? ORDER BY a.provider`,
    )
    .all(p.id) as Record<string, any>[];
  return {
    id: p.id,
    text: p.text,
    title: p.title,
    status: p.status,
    source: p.source ?? null,
    scheduledAt: p.scheduled_at,
    createdAt: p.created_at,
    media: getMediaList(JSON.parse(p.media_ids)).map((m) => ({
      id: m.id,
      filename: m.filename,
      kind: m.kind,
      mime: m.mime,
      size: m.size,
      url: `/media/${m.publicUrl.split("/").pop()}`,
    })),
    targets: targets.map((t) => ({
      id: t.id,
      accountId: t.account_id,
      provider: t.provider,
      name: t.name ?? "Compte supprimé",
      avatarUrl: t.avatar_url,
      textOverride: t.text_override,
      status: t.status,
      url: t.external_url,
      error: t.error,
      attempts: t.attempts,
      publishedAt: t.published_at,
    })),
  };
}

api.get("/posts", (c) => {
  const rows = db
    .prepare("SELECT * FROM posts ORDER BY COALESCE(scheduled_at, created_at) DESC LIMIT 1000")
    .all() as Record<string, any>[];
  return c.json(rows.map(serializePost));
});

interface PostBody {
  text?: string;
  title?: string;
  mediaIds?: string[];
  accountIds?: number[];
  overrides?: Record<string, string | null>;
  scheduledAt?: number | null;
  action?: "draft" | "schedule" | "now";
}

/** Valide le contenu pour chaque compte ciblé. Renvoie les erreurs par compte. */
function validateBody(b: PostBody): Record<number, string> {
  const errors: Record<number, string> = {};
  const media = getMediaList(b.mediaIds ?? []);
  for (const id of b.accountIds ?? []) {
    const acc = getAccount(id);
    if (!acc) {
      errors[id] = "Compte introuvable";
      continue;
    }
    const text = b.overrides?.[id] ?? b.text ?? "";
    const err = publishers[acc.provider].validate({ text, media });
    if (err) errors[id] = err;
  }
  return errors;
}

function savePost(b: PostBody, existingId?: number): { id?: number; error?: string; errors?: Record<number, string> } {
  const action = b.action ?? "draft";
  const accountIds = [...new Set((b.accountIds ?? []).map(Number))];
  const mediaIds = (b.mediaIds ?? []).filter((id) => typeof id === "string").slice(0, 20);
  if (getMediaList(mediaIds).length !== mediaIds.length) return { error: "Média introuvable" };
  if (action !== "draft") {
    if (!accountIds.length) return { error: "Choisis au moins un compte." };
    const errors = validateBody({ ...b, accountIds, mediaIds });
    if (Object.keys(errors).length) return { error: "Contenu incompatible avec certains réseaux.", errors };
    if (action === "schedule" && !(Number(b.scheduledAt) > Date.now() - 60_000)) return { error: "Date de programmation invalide ou passée." };
  }
  const status = action === "draft" ? "draft" : "scheduled";
  const scheduledAt = action === "now" ? Date.now() : b.scheduledAt ? Number(b.scheduledAt) : null;
  const now = Date.now();
  let id = existingId;

  db.exec("BEGIN");
  try {
    if (id) {
      db.prepare(
        "UPDATE posts SET text = ?, title = ?, media_ids = ?, scheduled_at = ?, status = ?, updated_at = ? WHERE id = ?",
      ).run(b.text ?? "", b.title ?? "", JSON.stringify(mediaIds), scheduledAt, status, now, id);
      db.prepare("DELETE FROM post_targets WHERE post_id = ?").run(id);
    } else {
      id = Number(
        db
          .prepare(
            "INSERT INTO posts (text, title, media_ids, scheduled_at, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
          )
          .run(b.text ?? "", b.title ?? "", JSON.stringify(mediaIds), scheduledAt, status, now, now).lastInsertRowid,
      );
    }
    const ins = db.prepare("INSERT INTO post_targets (post_id, account_id, text_override) VALUES (?, ?, ?)");
    for (const acc of accountIds) {
      if (!getAccount(acc)) continue;
      const o = b.overrides?.[acc];
      ins.run(id, acc, typeof o === "string" && o !== b.text ? o : null);
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  if (action === "now") void publishPost(id!);
  return { id };
}

api.post("/validate", async (c) => c.json({ errors: validateBody(await c.req.json<PostBody>()) }));

api.post("/posts", async (c) => {
  const r = savePost(await c.req.json<PostBody>());
  return r.error ? c.json(r, 400) : c.json(r);
});

api.put("/posts/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const p = db.prepare("SELECT status FROM posts WHERE id = ?").get(id) as { status: string } | undefined;
  if (!p) return c.json({ error: "Post introuvable" }, 404);
  if (p.status !== "draft" && p.status !== "scheduled") return c.json({ error: "Ce post a déjà été publié." }, 409);
  const r = savePost(await c.req.json<PostBody>(), id);
  return r.error ? c.json(r, 400) : c.json(r);
});

api.delete("/posts/:id", (c) => {
  const id = Number(c.req.param("id"));
  const p = db.prepare("SELECT status FROM posts WHERE id = ?").get(id) as { status: string } | undefined;
  if (p?.status === "publishing") return c.json({ error: "Publication en cours, patiente." }, 409);
  db.prepare("DELETE FROM posts WHERE id = ?").run(id);
  return c.json({ ok: true });
});

api.post("/posts/:id/retry", (c) => {
  const id = Number(c.req.param("id"));
  const r = db.prepare("UPDATE post_targets SET status = 'pending', error = NULL WHERE post_id = ? AND status = 'failed'").run(id);
  if (!r.changes) return c.json({ error: "Rien à réessayer." }, 400);
  void publishPost(id);
  return c.json({ ok: true });
});

api.post("/posts/:id/duplicate", (c) => {
  const id = Number(c.req.param("id"));
  const p = db.prepare("SELECT * FROM posts WHERE id = ?").get(id) as Record<string, any> | undefined;
  if (!p) return c.json({ error: "Post introuvable" }, 404);
  const now = Date.now();
  const newId = Number(
    db
      .prepare("INSERT INTO posts (text, title, media_ids, scheduled_at, status, created_at, updated_at) VALUES (?, ?, ?, NULL, 'draft', ?, ?)")
      .run(p.text, p.title, p.media_ids, now, now).lastInsertRowid,
  );
  db.prepare(
    "INSERT INTO post_targets (post_id, account_id, text_override) SELECT ?, account_id, text_override FROM post_targets WHERE post_id = ?",
  ).run(newId, id);
  rollupStatus(newId);
  return c.json({ id: newId });
});

api.route("/canva", canvaApi);
app.route("/api", api);

app.get("/", requireAuth, async (c) => c.html(await readFile(resolve(PUBLIC, "index.html"), "utf8")));

startScheduler();
startCanvaWatcher();
startCleanup();
// Par défaut, l'app n'écoute que sur ce PC (127.0.0.1) : elle n'est pas visible depuis les
// autres appareils du Wi-Fi. HOST=0.0.0.0 seulement pour Docker ou un serveur.
serve({ fetch: app.fetch, port: config.port, hostname: process.env.HOST ?? "127.0.0.1" }, (info) => {
  console.log(`Multiposter prêt sur http://localhost:${info.port} (URL publique : ${config.publicUrl})`);
  // Lanceur Windows / macOS : ouvre l'app dans le navigateur une fois prête.
  if (process.env.OPEN_BROWSER === "1") {
    const url = `http://127.0.0.1:${info.port}/open`;
    const [cmd, args] =
      process.platform === "win32" ? ["cmd", ["/c", "start", "", url]] : process.platform === "darwin" ? ["open", [url]] : ["xdg-open", [url]];
    const child = spawn(cmd, args, { detached: true, stdio: "ignore" });
    child.on("error", () => console.log(`Ouvre ${url} dans ton navigateur.`));
    child.unref();
  }
});
