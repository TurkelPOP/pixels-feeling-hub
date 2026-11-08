import { spawn } from "node:child_process";
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { createReadStream, existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Readable } from "node:stream";

import { serve } from "@hono/node-server";
import { Hono, type Context, type Next } from "hono";

import { accountsPage, config, mediaDir } from "./config.ts";
import { pkcePair, randomId } from "./crypto.ts";
import { db, deleteAccount, getAccount, getOwnedAccount, listAccounts, upsertAccount } from "./db.ts";
import { checkMediaSignature, getMediaList, mediaOwner, purgeUnused, saveUpload } from "./media.ts";
import { migrateWorkspaces } from "./workspace.ts";
import { registerProfileApi, sharedAccountsFor } from "./profiles.ts";
import { applyAppSettings, registerAppSettingsApi } from "./appsettings.ts";
import { flows, publishers } from "./providers/index.ts";
import { effectiveMedia, sanitizeOptions } from "./providers/types.ts";
import { canvaApi, canvaRoutes, checkCanvaRules, startCanvaWatcher } from "./canva.ts";
import { driveApi, driveRoutes, finishDriveOAuth } from "./gdrive.ts";
import { registerHashtagApi } from "./hashtags.ts";
import { registerMentionApi, resolveMentions } from "./mentions.ts";
import { registerMaintenanceApi, startBackups } from "./maintenance.ts";
import { notify, registerPushApi } from "./push.ts";
import { registerPresetApi } from "./presets.ts";
import { registerStatsApi, startStats } from "./stats.ts";
import { registerUserKeysApi, runAs, userKeysMiddleware } from "./userkeys.ts";
import { registerRecapApi, sendDueRecaps, startRecaps } from "./recap.ts";
import { musicFile, registerMusicApi } from "./music.ts";
import { currentUser, isLogged, ownerId, registerAuth, registerUserApi, requireAuth, securityEvents, securityStatus } from "./auth.ts";
import { autostartStatus, setAutostart } from "./autostart.ts";
import { setupTailscale, tailscaleState } from "./tailscale.ts";
import { DRAFT_DAYS, RETENTION_DAYS, startCleanup } from "./cleanup.ts";
import { publishPost, rollupStatus, startScheduler, tick } from "./scheduler.ts";

// Espaces personnels : les données de l'ancienne version partagée reviennent au propriétaire.
migrateWorkspaces(ownerId());
// Clés des réseaux saisies dans l'interface par le propriétaire (les variables du serveur priment).
applyAppSettings();

const app = new Hono();
const PUBLIC = resolve(import.meta.dirname, "../public");

// Adresses par lesquelles l'app accepte d'être appelée. Bloque le « DNS rebinding » : un site
// malveillant ouvert dans ton navigateur ne peut pas se faire passer pour 127.0.0.1.
const allowedHosts = new Set(
  [
    "localhost",
    "127.0.0.1",
    "[::1]",
    new URL(config.publicUrl).hostname,
    new URL(config.appUrl).hostname,
    new URL(config.mediaPublicUrl).hostname,
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
  c.header("Permissions-Policy", "camera=(self), microphone=(self), geolocation=()");
  if ((c.res.headers.get("content-type") ?? "").startsWith("text/html")) c.header("Content-Security-Policy", CSP);
  // En ligne : le navigateur refusera toujours la version non chiffrée du site.
  if (config.serverMode) c.header("Strict-Transport-Security", "max-age=31536000");
});

// ---------- Authentification (voir auth.ts) ----------

registerAuth(app);

// Le lanceur Windows ouvre /open, qui mène à l'interface.
app.get("/open", (c) => c.redirect(`${config.appUrl}/`));

// Petits points de contrôle pour vérifier que /oauth et /media sont bien joignables depuis Internet.
app.get("/oauth/ping", (c) => c.text("multiposter-ok"));
app.get("/media/ping", (c) => c.text("multiposter-ok"));

// Réveil par une tâche planifiée de l'hébergeur (toutes les 5 min) : publie les posts arrivés à
// échéance et vérifie Canva, même si le site s'était mis en veille faute de visites.
// Protégé par CRON_SECRET (en-tête Authorization: Bearer … ou ?token=…).
app.get("/cron/tick", async (c) => {
  const secret = config.cronSecret;
  const given = c.req.header("authorization")?.replace(/^Bearer\s+/i, "") ?? c.req.query("token") ?? "";
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(secret ?? randomUUID()).digest();
  if (!secret || secret.length < 32 || !timingSafeEqual(a, b)) return c.notFound();
  // On répond tout de suite ; la publication continue en arrière-plan dans le processus du site.
  void tick();
  void sendDueRecaps().catch((e) => console.error("[récap]", e));
  void checkCanvaRules();
  return c.text("ok");
});

// ---------- Fichiers publics ----------

const MIME: Record<string, string> = {
  html: "text/html; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
  svg: "image/svg+xml",
  png: "image/png",
  mp3: "audio/mpeg",
  jpg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
};

function sendFile(c: Context, path: string, cache = "no-cache", forcedType?: string) {
  if (!existsSync(path)) return c.notFound();
  const { size } = statSync(path);
  const type = forcedType ?? MIME[path.split(".").pop()!] ?? "application/octet-stream";
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

// Médias : lisibles par toi (connecté) ou via un lien signé de 24 h donné aux réseaux au moment
// de publier. Sans l'un ou l'autre : introuvable, même en connaissant l'adresse.
app.get("/media/:file{[A-Za-z0-9_-]+\\.[a-z0-9]+}", async (c) => {
  const file = c.req.param("file");
  const signed = checkMediaSignature(file, c.req.query("exp"), c.req.query("sig"));
  if (!signed && !((await isLogged(c)) && mediaOwner(file) === currentUser(c)?.id)) return c.notFound();
  return sendFile(c, resolve(mediaDir, file), "private, max-age=3600");
});

// Appli installable (écran d'accueil du téléphone) : manifeste et service worker, à la racine.
app.get("/manifest.webmanifest", (c) => {
  c.header("Content-Type", "application/manifest+json; charset=utf-8");
  return c.body(JSON.stringify({
    name: "PTZ Posting", short_name: "PTZ Posting", lang: "fr", dir: "ltr",
    description: "Publication multi-réseaux de PTZ Corp",
    start_url: "/", scope: "/", display: "standalone", orientation: "portrait",
    background_color: "#020b2c", theme_color: "#023197",
    icons: [
      { src: "/assets/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/assets/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/assets/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Nouveau post", url: "/#compose" },
      { name: "Planning", url: "/#queue" },
    ],
  }));
});
app.get("/sw.js", (c) => sendFile(c, resolve(PUBLIC, "sw.js"), "no-cache"));

// Outil privé : rien à indexer ni à explorer pour les moteurs de recherche.
app.get("/robots.txt", (c) => c.text("User-agent: *\nDisallow: /\n"));
// Validation du site dans Google Search Console (méthode « fichier HTML ») : GOOGLE_SITE_VERIFICATION
// contient le nom du fichier donné par Google, par exemple google1234abcd5678ef90.html.
app.get("/:file{google[0-9a-f]{8,32}\\.html}", (c) => {
  const file = c.req.param("file");
  return process.env.GOOGLE_SITE_VERIFICATION?.trim() === file ? c.text(`google-site-verification: ${file}`) : c.notFound();
});
app.get("/assets/:file{[a-z0-9-]+\\.(css|js|svg|png|mp3)}", (c) => sendFile(c, resolve(PUBLIC, c.req.param("file"))));

// ---------- OAuth ----------

app.use("/oauth/canva/start", requireAuth, userKeysMiddleware);
app.route("/", canvaRoutes);
app.use("/oauth/gdrive/start", requireAuth, userKeysMiddleware);
app.route("/", driveRoutes);

app.get("/oauth/:flow/start", requireAuth, userKeysMiddleware, (c) => {
  const flow = flows[c.req.param("flow") ?? ""] as (typeof flows)[string] | undefined;
  if (!flow?.configured()) return c.text("Réseau non configuré (voir .env)", 400);
  const state = randomId(24);
  const { verifier, challenge } = pkcePair();
  db.prepare("INSERT INTO oauth_states (state, provider, verifier, created_at, owner_id) VALUES (?, ?, ?, ?, ?)").run(
    state,
    flow.id,
    flow.usesPkce ? verifier : null,
    Date.now(),
    currentUser(c)!.id,
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
  const row = db.prepare("DELETE FROM oauth_states WHERE state = ? RETURNING provider, verifier, owner_id").get(state ?? "") as
    | { provider: string; verifier: string | null; owner_id: number }
    | undefined;
  const back = (msg: string, ok = false) => c.redirect(accountsPage(msg, ok));
  // Les clés d'app de la personne qui a lancé la connexion (sa propre app développeur).
  return runAs(row?.owner_id, async () => {
    // Google Drive partage l'adresse de retour de YouTube : le « state » dit lequel des deux.
    if (row?.provider === "gdrive" && flow?.id === "google") {
      if (error || !code) return back(`Connexion Google Drive annulée${error ? ` (${error})` : ""}.`);
      try {
        return back(`Google Drive connecté (${await finishDriveOAuth(row.owner_id, row.verifier!, code)}).`, true);
      } catch (e) {
        console.error("[oauth gdrive]", e);
        return back(e instanceof Error ? e.message : "Échec de la connexion Google Drive");
      }
    }
    if (!flow || !row || row.provider !== flow.id) return back("Lien de connexion expiré, recommence.");
    if (error || !code) return back(`Connexion annulée : ${error_description ?? error ?? "pas de code"}`);
    try {
      const accounts = await flow.callback(code, row.verifier);
      for (const a of accounts) upsertAccount(a, row.owner_id);
      return back(`${accounts.length} compte(s) connecté(s) : ${accounts.map((a) => a.name).join(", ")}`, true);
    } catch (e) {
      console.error(`[oauth ${flow.id}]`, e);
      return back(e instanceof Error ? e.message : "Échec de la connexion");
    }
  });
});

// ---------- API ----------

const api = new Hono();
api.use("*", requireAuth);
// Chaque requête utilise les clés d'app de la personne connectée (sa propre app développeur).
api.use("*", userKeysMiddleware);

api.get("/meta", (c) =>
  c.json({
    timezone: config.timezone,
    retention: { draftDays: DRAFT_DAYS, publishedDays: RETENTION_DAYS },
    flows: Object.values(flows).map((f) => ({ id: f.id, label: f.label, providers: f.providers, configured: f.configured() })),
    publishers: Object.values(publishers).map((p) => ({ id: p.id, label: p.label, maxText: p.maxText })),
  }),
);

api.get("/system", (c) =>
  c.json({ autostart: autostartStatus(), publicUrl: config.publicUrl, mediaPublicUrl: config.mediaPublicUrl, tailscale: tailscaleState }),
);

api.get("/security", (c) => c.json({ ...securityStatus(c), events: securityEvents(30) }));
registerUserApi(api);

api.post("/system/tailscale/retry", async (c) => {
  await setupTailscale(useTailscaleHost);
  return c.json({ tailscale: tailscaleState, publicUrl: config.publicUrl });
});

/** Vérifie depuis Internet que les réseaux pourront joindre /oauth et /media. */
api.get("/system/public-check", async (c) => {
  const probe = async (url: string) => {
    if (/^http:\/\/(127\.0\.0\.1|localhost)/.test(url)) return { ok: false, reason: "adresse locale : à remplacer par l'adresse Tailscale" };
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      const t = await r.text();
      return t.includes("multiposter-ok") ? { ok: true } : { ok: false, reason: `réponse inattendue (HTTP ${r.status})` };
    } catch (e) {
      return { ok: false, reason: e instanceof Error ? e.message : "injoignable" };
    }
  };
  const [oauth, media] = await Promise.all([probe(`${config.publicUrl}/oauth/ping`), probe(`${config.mediaPublicUrl}/media/ping`)]);
  return c.json({ oauth, media });
});

api.put("/system/autostart", async (c) => {
  const { enabled } = await c.req.json<{ enabled?: boolean }>();
  try {
    return c.json({ autostart: await setAutostart(!!enabled) });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : "Réglage impossible" }, 400);
  }
});

const uid = (c: Context) => currentUser(c)!.id;

api.get("/accounts", (c) => {
  const mine = listAccounts(uid(c)).map((a) => ({
    id: a.id,
    provider: a.provider,
    name: a.name,
    avatarUrl: a.avatarUrl,
    expiresAt: a.expiresAt,
    canRefresh: !!a.refreshToken || a.provider === "threads",
  }));
  // Comptes d'un profil partagé avec moi : nom et réseau seulement, jamais les accès.
  const shared = [...sharedAccountsFor(uid(c))].map(([id, owner]) => {
    const a = getAccount(id);
    const o = db.prepare("SELECT name FROM users WHERE id = ?").get(owner) as { name: string } | undefined;
    return a ? { id: a.id, provider: a.provider, name: a.name, avatarUrl: a.avatarUrl, shared: { ownerId: owner, ownerName: o?.name ?? "?" } } : null;
  }).filter(Boolean);
  return c.json([...mine, ...shared]);
});

registerProfileApi(api);
registerHashtagApi(api);
registerMentionApi(api);
registerMaintenanceApi(api, sendFile);
registerPushApi(api);
registerPresetApi(api);
registerStatsApi(api);
registerUserKeysApi(api);
registerRecapApi(api);
registerMusicApi(api);
// Écoute d'une musique de sa bibliothèque (lecture partielle possible pour le lecteur audio).
api.get("/music/:id/file", (c) => {
  const f = musicFile(c.req.param("id"), uid(c));
  return f ? sendFile(c, f.path, "private, max-age=3600", f.mime) : c.notFound();
});
registerAppSettingsApi(api);

api.delete("/accounts/:id", (c) => {
  deleteAccount(Number(c.req.param("id")), uid(c));
  return c.json({ ok: true });
});

api.put("/media", async (c) => {
  const mime = (c.req.header("content-type") ?? "").split(";")[0].trim();
  const filename = c.req.query("filename") ?? "fichier";
  if (!c.req.raw.body) return c.json({ error: "Corps vide" }, 400);
  try {
    const m = await saveUpload(c.req.raw.body, filename, mime, uid(c));
    return c.json({ id: m.id, filename: m.filename, mime: m.mime, size: m.size, kind: m.kind, url: m.localUrl });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : "Upload impossible" }, 400);
  }
});

function serializePost(p: Record<string, any>, viewer?: number) {
  const targets = db
    .prepare(
      `SELECT t.id, t.account_id, t.text_override, t.options, t.status, t.external_url, t.error, t.attempts, t.published_at, t.stats, t.stats_at,
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
    ownerId: p.owner_id,
    authorId: p.author_id ?? null,
    authorName: p.author_id ? ((db.prepare("SELECT name FROM users WHERE id = ?").get(p.author_id) as { name: string } | undefined)?.name ?? null) : null,
    ownerName: viewer != null && p.owner_id !== viewer ? ((db.prepare("SELECT name FROM users WHERE id = ?").get(p.owner_id) as { name: string } | undefined)?.name ?? null) : null,
    comments: (db.prepare("SELECT COUNT(*) AS n FROM post_comments WHERE post_id = ?").get(p.id) as { n: number }).n,
    scheduledAt: p.scheduled_at,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
    media: getMediaList(JSON.parse(p.media_ids)).map((m) => ({
      id: m.id,
      filename: m.filename,
      kind: m.kind,
      mime: m.mime,
      size: m.size,
      // Média d'une autre personne (proposition) : lien signé, sinon le navigateur ne l'afficherait pas.
      url: viewer == null || m.ownerId === viewer ? m.localUrl : m.publicUrl,
    })),
    targets: targets.map((t) => ({
      id: t.id,
      accountId: t.account_id,
      provider: t.provider,
      name: t.name ?? "Compte supprimé",
      avatarUrl: t.avatar_url,
      textOverride: t.text_override,
      options: JSON.parse(t.options || "{}"),
      status: t.status,
      url: t.external_url,
      error: t.error,
      attempts: t.attempts,
      publishedAt: t.published_at,
      stats: t.stats ? JSON.parse(t.stats) : null,
      statsAt: t.stats_at,
    })),
  };
}

api.get("/posts", (c) => {
  const rows = db
    .prepare("SELECT * FROM posts WHERE owner_id = ? OR author_id = ? ORDER BY COALESCE(scheduled_at, created_at) DESC LIMIT 1000")
    .all(uid(c), uid(c)) as Record<string, any>[];
  return c.json(rows.map((p) => serializePost(p, uid(c))));
});

interface PostBody {
  text?: string;
  title?: string;
  mediaIds?: string[];
  accountIds?: number[];
  overrides?: Record<string, string | null>;
  /** Options par compte (format, médias, visibilité…). */
  options?: Record<string, unknown>;
  scheduledAt?: number | null;
  action?: "draft" | "schedule" | "now";
}

/** Valide le contenu pour chaque compte ciblé. Renvoie les erreurs par compte. */
function validateBody(b: PostBody, owner: number, mentionOwner = owner): Record<number, string> {
  const errors: Record<number, string> = {};
  // Les médias ont déjà été vérifiés (appartenance) par l'appelant.
  const media = getMediaList(b.mediaIds ?? []);
  for (const id of b.accountIds ?? []) {
    const acc = getOwnedAccount(id, owner);
    if (!acc) {
      errors[id] = "Compte introuvable";
      continue;
    }
    const text = resolveMentions(b.overrides?.[id] ?? b.text ?? "", acc.provider, mentionOwner);
    const options = sanitizeOptions(b.options?.[id]);
    const err = publishers[acc.provider].validate({ text, media: effectiveMedia(media, options), options });
    if (err) errors[id] = err;
  }
  return errors;
}

/**
 * Espace d'un post selon ses comptes : le mien, ou celui d'une personne qui m'a partagé un profil
 * (le post lui appartient, j'en suis l'auteur, et il part en validation chez elle).
 */
function resolveSpace(me: number, accountIds: number[]): { owner: number; author: number | null } | { error: string } {
  const others = accountIds.filter((id) => !getOwnedAccount(id, me));
  if (!others.length) return { owner: me, author: null };
  const shared = sharedAccountsFor(me);
  if (others.some((id) => !shared.has(id))) return { error: "Compte introuvable" };
  const owners = new Set(others.map((id) => shared.get(id)!));
  if (owners.size > 1 || others.length !== accountIds.length)
    return { error: "Un même post ne peut pas mélanger tes comptes et ceux d'un profil partagé : fais deux posts." };
  return { owner: [...owners][0], author: me };
}

function savePost(b: PostBody, me: number, existingId?: number): { id?: number; error?: string; errors?: Record<number, string>; review?: boolean } {
  const action = b.action ?? "draft";
  const accountIds = [...new Set((b.accountIds ?? []).map(Number))];
  const mediaIds = (b.mediaIds ?? []).filter((id) => typeof id === "string").slice(0, 20);
  let space: { owner: number; author: number | null };
  if (existingId) {
    const p = db.prepare("SELECT owner_id, author_id FROM posts WHERE id = ?").get(existingId) as { owner_id: number; author_id: number | null };
    space = { owner: p.owner_id, author: p.author_id };
    // L'auteur d'une proposition ne peut cibler que les comptes partagés de ce propriétaire.
    if (me !== p.owner_id) {
      const sh = sharedAccountsFor(me);
      if (accountIds.some((id) => sh.get(id) !== p.owner_id)) return { error: "Compte introuvable" };
    } else if (accountIds.some((id) => !getOwnedAccount(id, me))) return { error: "Compte introuvable" };
  } else {
    const s = resolveSpace(me, accountIds);
    if ("error" in s) return s;
    space = s;
  }
  const owner = space.owner;
  // Médias : envoyés par moi, ou déjà dans l'espace du post (proposition de l'autre personne).
  const okMedia = getMediaList(mediaIds).filter((m) => m.ownerId === me || m.ownerId === owner || m.ownerId === space.author);
  if (okMedia.length !== mediaIds.length) return { error: "Média introuvable" };
  if (action !== "draft") {
    if (!accountIds.length) return { error: "Choisis au moins un compte." };
    const errors = validateBody({ ...b, accountIds, mediaIds }, owner, space.author ?? owner);
    if (Object.keys(errors).length) return { error: "Contenu incompatible avec certains réseaux.", errors };
    if (action === "schedule" && !(Number(b.scheduledAt) > Date.now() - 60_000)) return { error: "Date de programmation invalide ou passée." };
  }
  // Proposition (profil partagé) : elle attend la validation du propriétaire.
  const review = action !== "draft" && me !== owner;
  const status = action === "draft" ? "draft" : review ? "review" : "scheduled";
  const scheduledAt = action === "now" ? Date.now() : b.scheduledAt ? Number(b.scheduledAt) : null;
  const now = Date.now();
  let id = existingId;
  let doneBefore: { account_id: number; external_url: string | null; published_at: number | null }[] = [];

  db.exec("BEGIN");
  try {
    if (id) {
      db.prepare(
        "UPDATE posts SET text = ?, title = ?, media_ids = ?, scheduled_at = ?, status = ?, updated_at = ? WHERE id = ? AND owner_id = ?",
      ).run(b.text ?? "", b.title ?? "", JSON.stringify(mediaIds), scheduledAt, status, now, id, owner);
      // Réseaux déjà publiés (par exemple terminés à la main dans l'appli Instagram) : on garde
      // leur état, pour ne jamais les republier quand on modifie le post.
      doneBefore = db.prepare("SELECT account_id, external_url, published_at FROM post_targets WHERE post_id = ? AND status = 'done'").all(id) as {
        account_id: number; external_url: string | null; published_at: number | null;
      }[];
      db.prepare("DELETE FROM post_targets WHERE post_id = ?").run(id);
    } else {
      id = Number(
        db
          .prepare(
            "INSERT INTO posts (text, title, media_ids, scheduled_at, status, created_at, updated_at, owner_id, author_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
          )
          .run(b.text ?? "", b.title ?? "", JSON.stringify(mediaIds), scheduledAt, status, now, now, owner, space.author).lastInsertRowid,
      );
    }
    const ins = db.prepare("INSERT INTO post_targets (post_id, account_id, text_override, options) VALUES (?, ?, ?, ?)");
    for (const acc of accountIds) {
      if (!getOwnedAccount(acc, owner)) continue;
      const o = b.overrides?.[acc];
      const opts = sanitizeOptions(b.options?.[acc]);
      ins.run(id, acc, typeof o === "string" && o !== b.text ? o : null, Object.keys(opts).length ? JSON.stringify(opts) : null);
    }
    for (const d of doneBefore)
      db.prepare("UPDATE post_targets SET status = 'done', external_url = ?, published_at = ? WHERE post_id = ? AND account_id = ?").run(
        d.external_url, d.published_at, id, d.account_id,
      );
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  if (action === "now" && !review) void publishPost(id!);
  if (review) {
    const who = db.prepare("SELECT name FROM users WHERE id = ?").get(me) as { name: string };
    void notify(owner, { title: `📝 ${who.name} propose un post`, body: (b.text ?? "").split("\n")[0].slice(0, 80) || "Post à valider", url: "/#queue", tag: `review-${id}` });
  }
  return { id, review };
}

api.post("/validate", async (c) => {
  const b = await c.req.json<PostBody>();
  const s = resolveSpace(uid(c), [...new Set((b.accountIds ?? []).map(Number))]);
  return c.json({ errors: "error" in s ? {} : validateBody(b, s.owner, s.author ?? s.owner) });
});

/** Post de la personne connectée uniquement : celui d'une autre personne est « introuvable ». */
const ownPost = (c: Context, id: number) =>
  db.prepare("SELECT * FROM posts WHERE id = ? AND owner_id = ?").get(id, uid(c)) as Record<string, any> | undefined;
/** Post visible par la personne : le sien, ou une proposition qu'elle a écrite pour un profil partagé. */
const accessPost = (c: Context, id: number) =>
  db.prepare("SELECT * FROM posts WHERE id = ? AND (owner_id = ? OR author_id = ?)").get(id, uid(c), uid(c)) as Record<string, any> | undefined;

api.post("/posts", async (c) => {
  const r = savePost(await c.req.json<PostBody>(), uid(c));
  return r.error ? c.json(r, 400) : c.json(r);
});

api.put("/posts/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const p = accessPost(c, id);
  if (!p) return c.json({ error: "Post introuvable" }, 404);
  const mine = p.owner_id === uid(c);
  if (!(mine ? ["draft", "scheduled", "review"] : ["draft", "review"]).includes(p.status))
    return c.json({ error: mine ? "Ce post a déjà été publié." : "Ce post a été validé : seul le propriétaire du profil peut encore le modifier." }, 409);
  const r = savePost(await c.req.json<PostBody>(), uid(c), id);
  if (r.error) return c.json(r, 400);
  // Médias retirés de ce post : supprimés tout de suite s'ils ne servent plus nulle part.
  await purgeUnused(JSON.parse(p.media_ids), uid(c));
  return c.json(r);
});

/** Média retiré de l'éditeur : supprimé tout de suite (sauf s'il sert encore à un post enregistré). */
api.delete("/media/:id{[A-Za-z0-9_-]{6,64}}", async (c) => c.json({ removed: await purgeUnused([c.req.param("id")], uid(c)) }));

api.delete("/posts/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const p = accessPost(c, id);
  if (!p) return c.json({ error: "Post introuvable" }, 404);
  if (p.status === "publishing") return c.json({ error: "Publication en cours, patiente." }, 409);
  if (p.owner_id !== uid(c) && !["draft", "review"].includes(p.status)) return c.json({ error: "Ce post a été validé : demande au propriétaire du profil." }, 409);
  db.prepare("DELETE FROM posts WHERE id = ?").run(id);
  await purgeUnused(JSON.parse(p.media_ids), uid(c));
  return c.json({ ok: true });
});

/** Contenu d'un post enregistré, au format de l'éditeur (pour le revalider avant de le programmer). */
function bodyFromPost(p: Record<string, any>): PostBody {
  const targets = db.prepare("SELECT account_id, text_override, options FROM post_targets WHERE post_id = ?").all(p.id) as Record<string, any>[];
  return {
    text: p.text, title: p.title, mediaIds: JSON.parse(p.media_ids),
    accountIds: targets.map((t) => t.account_id),
    overrides: Object.fromEntries(targets.filter((t) => t.text_override != null).map((t) => [t.account_id, t.text_override])),
    options: Object.fromEntries(targets.filter((t) => t.options).map((t) => [t.account_id, JSON.parse(t.options)])),
  } as PostBody;
}

/** Programme un brouillon (ou déplace un post programmé) à une date, après vérification. */
function scheduleExisting(c: Context, id: number, at: number): { ok: true } | { error: string } {
  const p = ownPost(c, id);
  if (!p) return { error: "Post introuvable" };
  if (p.status !== "draft" && p.status !== "scheduled") return { error: "Ce post a déjà été publié." };
  if (!(at > Date.now() - 60_000)) return { error: "Date passée." };
  const body = bodyFromPost(p);
  if (!body.accountIds?.length) return { error: "Aucun réseau coché : ouvre le brouillon pour choisir ses comptes." };
  const errors = validateBody(body, uid(c), p.author_id ?? uid(c));
  const first = Object.values(errors)[0];
  if (first) return { error: first };
  db.prepare("UPDATE posts SET status = 'scheduled', scheduled_at = ?, updated_at = ? WHERE id = ? AND owner_id = ?").run(at, Date.now(), id, uid(c));
  return { ok: true };
}

/** Programmation en lot : [{ id, scheduledAt }]. Chaque post est vérifié séparément. */
api.post("/posts/batch-schedule", async (c) => {
  const b = await c.req.json<{ items?: { id: number; scheduledAt: number }[] }>().catch(() => ({}) as { items?: { id: number; scheduledAt: number }[] });
  const items = (Array.isArray(b.items) ? b.items : []).slice(0, 100);
  if (!items.length) return c.json({ error: "Aucun post choisi." }, 400);
  return c.json({ results: items.map((it) => ({ id: Number(it.id), ...scheduleExisting(c, Number(it.id), Number(it.scheduledAt)) })) });
});

/** Changer la date d'un post programmé (glisser-déposer dans le calendrier). */
api.post("/posts/:id/reschedule", async (c) => {
  const id = Number(c.req.param("id"));
  const p = ownPost(c, id);
  if (!p || p.status !== "scheduled") return c.json({ error: "Seul un post programmé peut être déplacé." }, 400);
  const b = await c.req.json<{ scheduledAt?: number }>().catch(() => ({}) as { scheduledAt?: number });
  const r = scheduleExisting(c, id, Number(b.scheduledAt));
  return "error" in r ? c.json(r, 400) : c.json(r);
});

// ---------- Travail à deux : validation et commentaires ----------

db.exec(`CREATE TABLE IF NOT EXISTS post_comments (
  id INTEGER PRIMARY KEY, post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL, text TEXT NOT NULL, created_at INTEGER NOT NULL
)`);

const userName = (id: number) => (db.prepare("SELECT name FROM users WHERE id = ?").get(id) as { name: string } | undefined)?.name ?? "?";

function addComment(postId: number, userId: number, text: string) {
  db.prepare("INSERT INTO post_comments (post_id, user_id, text, created_at) VALUES (?, ?, ?, ?)").run(postId, userId, text.slice(0, 2000), Date.now());
}

/** Valider une proposition : programmée à sa date (ou publiée tout de suite si la date est passée). */
api.post("/posts/:id/approve", async (c) => {
  const id = Number(c.req.param("id"));
  const p = ownPost(c, id);
  if (!p || p.status !== "review") return c.json({ error: "Rien à valider." }, 400);
  const errors = validateBody(bodyFromPost(p), uid(c), p.author_id ?? uid(c));
  const first = Object.values(errors)[0];
  if (first) return c.json({ error: first }, 400);
  const at = p.scheduled_at && p.scheduled_at > Date.now() + 60_000 ? p.scheduled_at : Date.now();
  db.prepare("UPDATE posts SET status = 'scheduled', scheduled_at = ?, updated_at = ? WHERE id = ?").run(at, Date.now(), id);
  if (at <= Date.now()) void publishPost(id);
  if (p.author_id) void notify(p.author_id, { title: "✅ Post validé", body: `${userName(uid(c))} a validé : ${String(p.text).split("\n")[0].slice(0, 70)}`, url: "/#queue", tag: `review-${id}` });
  return c.json({ ok: true, publishedNow: at <= Date.now() });
});

/** Demander des modifications : la proposition revient en brouillon chez son auteur, avec le commentaire. */
api.post("/posts/:id/request-changes", async (c) => {
  const id = Number(c.req.param("id"));
  const p = ownPost(c, id);
  if (!p || p.status !== "review") return c.json({ error: "Rien à faire sur ce post." }, 400);
  const { comment } = await c.req.json<{ comment?: string }>().catch(() => ({ comment: "" }));
  db.prepare("UPDATE posts SET status = 'draft', updated_at = ? WHERE id = ?").run(Date.now(), id);
  if (String(comment ?? "").trim()) addComment(id, uid(c), String(comment).trim());
  if (p.author_id) void notify(p.author_id, { title: "↩ Modifications demandées", body: String(comment ?? "").trim().slice(0, 100) || "Ouvre le post pour voir", url: "/#queue", tag: `review-${id}` });
  return c.json({ ok: true });
});

api.get("/posts/:id/comments", (c) => {
  const id = Number(c.req.param("id"));
  if (!accessPost(c, id)) return c.json({ error: "Post introuvable" }, 404);
  return c.json((db.prepare("SELECT * FROM post_comments WHERE post_id = ? ORDER BY id").all(id) as Record<string, any>[]).map((r) => ({
    id: r.id, text: r.text, at: r.created_at, author: userName(r.user_id), mine: r.user_id === uid(c),
  })));
});

api.post("/posts/:id/comments", async (c) => {
  const id = Number(c.req.param("id"));
  const p = accessPost(c, id);
  if (!p) return c.json({ error: "Post introuvable" }, 404);
  const { text } = await c.req.json<{ text?: string }>().catch(() => ({ text: "" }));
  const t = String(text ?? "").trim();
  if (!t) return c.json({ error: "Commentaire vide." }, 400);
  addComment(id, uid(c), t);
  // Prévient l'autre personne du post (propriétaire ↔ auteur).
  const other = uid(c) === p.owner_id ? p.author_id : p.owner_id;
  if (other && other !== uid(c)) void notify(other, { title: `💬 ${userName(uid(c))}`, body: t.slice(0, 120), url: "/#queue", tag: `comment-${id}` });
  return c.json({ ok: true });
});

/** Réseau publié à la main (ex. « Finir dans Instagram » pour ajouter une musique) : marqué publié. */
api.post("/posts/:id/targets/:tid/manual", (c) => {
  const id = Number(c.req.param("id"));
  if (!ownPost(c, id)) return c.json({ error: "Post introuvable" }, 404);
  const r = db
    .prepare("UPDATE post_targets SET status = 'done', error = NULL, published_at = ? WHERE id = ? AND post_id = ? AND status IN ('pending', 'failed')")
    .run(Date.now(), Number(c.req.param("tid")), id);
  if (!r.changes) return c.json({ error: "Ce réseau est déjà publié ou en cours de publication." }, 409);
  rollupStatus(id);
  return c.json({ ok: true });
});

api.post("/posts/:id/retry", (c) => {
  const id = Number(c.req.param("id"));
  if (!ownPost(c, id)) return c.json({ error: "Post introuvable" }, 404);
  const r = db.prepare("UPDATE post_targets SET status = 'pending', error = NULL WHERE post_id = ? AND status = 'failed'").run(id);
  if (!r.changes) return c.json({ error: "Rien à réessayer." }, 400);
  void publishPost(id);
  return c.json({ ok: true });
});

api.post("/posts/:id/duplicate", (c) => {
  const id = Number(c.req.param("id"));
  const p = ownPost(c, id);
  if (!p) return c.json({ error: "Post introuvable" }, 404);
  const now = Date.now();
  const newId = Number(
    db
      .prepare("INSERT INTO posts (text, title, media_ids, scheduled_at, status, created_at, updated_at, owner_id) VALUES (?, ?, ?, NULL, 'draft', ?, ?, ?)")
      .run(p.text, p.title, p.media_ids, now, now, uid(c)).lastInsertRowid,
  );
  db.prepare(
    "INSERT INTO post_targets (post_id, account_id, text_override, options) SELECT ?, account_id, text_override, options FROM post_targets WHERE post_id = ?",
  ).run(newId, id);
  rollupStatus(newId);
  return c.json({ id: newId });
});

api.route("/canva", canvaApi);
api.route("/gdrive", driveApi);
app.route("/api", api);

app.get("/", requireAuth, async (c) => c.html(await readFile(resolve(PUBLIC, "index.html"), "utf8")));

/** Adopte l'adresse Tailscale comme adresse publique (retours OAuth et médias). */
function useTailscaleHost(host: string) {
  const url = `https://${host}`;
  allowedHosts.add(host);
  if (!process.env.PUBLIC_URL || /^http:\/\/(127\.0\.0\.1|localhost)/.test(config.publicUrl)) config.publicUrl = url;
  if (!process.env.MEDIA_PUBLIC_URL) config.mediaPublicUrl = config.publicUrl;
  console.log(`Tailscale : /oauth et /media ouverts sur ${url}`);
}

startScheduler();
void setupTailscale(useTailscaleHost).then((s) => {
  if (s.mode === "auto" && s.error) console.log(`Tailscale : ${s.error}${s.enableUrl ? ` ${s.enableUrl}` : ""}`);
});
startCanvaWatcher();
startCleanup();
startBackups();
startRecaps();
startStats();
// Par défaut, l'app n'écoute que sur ce PC (127.0.0.1) : elle n'est pas visible depuis les
// autres appareils du Wi-Fi. HOST=0.0.0.0 seulement pour Docker ou un serveur.
serve({ fetch: app.fetch, port: config.port, hostname: process.env.HOST ?? "127.0.0.1" }, (info) => {
  console.log(`PTZ Posting prêt sur http://localhost:${info.port} (URL publique : ${config.publicUrl})`);
  // Récapitulatif des réglages (sans aucun secret), pour vérifier la configuration dans les journaux.
  console.log(
    [
      `Mode : ${config.serverMode ? "SERVEUR (double authentification obligatoire)" : "local"}`,
      `APP_URL=${config.appUrl}`,
      `ADMIN_NAME=${process.env.ADMIN_NAME ?? "admin (par défaut)"}`,
      `ADMIN_PASSWORD_HASH ${config.adminPasswordHash ? "présent" : "absent"}`,
      `CRON_SECRET ${config.cronSecret && config.cronSecret.length >= 32 ? "présent" : "absent"}`,
      `alertes ${config.alertWebhookUrl ? "configurées" : "non configurées"}`,
      `réseaux activés : ${[...Object.values(flows).filter((f) => f.configured()).map((f) => f.label), ...(config.canva.clientId && config.canva.clientSecret ? ["Canva"] : [])].join(", ") || "aucun"}`,
      `TRUST_PROXY=${process.env.TRUST_PROXY ?? "non"}`,
    ].join(" · "),
  );
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
