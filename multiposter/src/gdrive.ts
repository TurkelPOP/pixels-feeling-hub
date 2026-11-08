// Connecteur Google Drive : chacun connecte SON Drive, parcourt ses images et vidéos, et les
// importe dans un post. Le fichier passe directement de Google au serveur : rien n'est téléchargé
// sur le téléphone, même pour une grosse vidéo.
// Utilise le même client OAuth Google que YouTube (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET),
// avec une adresse de retour à part : /oauth/gdrive/callback. Accès en LECTURE SEULE.
import { Hono } from "hono";

import { currentUser } from "./auth.ts";
import { callbackUrl, config } from "./config.ts";
import { pkcePair, randomId, seal, unseal } from "./crypto.ts";
import { db } from "./db.ts";
import { form, json, request } from "./http.ts";
import { saveUpload } from "./media.ts";

const SCOPE = "https://www.googleapis.com/auth/drive.readonly";
// Adresses modifiables pour les tests uniquement.
const DRIVE = (process.env.GDRIVE_API_URL ?? "https://www.googleapis.com/drive/v3").replace(/\/+$/, "");
const TOKEN_URL = process.env.GOOGLE_TOKEN_URL ?? "https://oauth2.googleapis.com/token";
const PUBLIC_DL = (process.env.GDRIVE_PUBLIC_URL ?? "https://drive.usercontent.google.com").replace(/\/+$/, "");
/** Formats acceptés par l'app (les mêmes que pour un envoi depuis le téléphone). */
const ACCEPTED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/quicktime", "video/webm"]);

/** Même adresse de retour que YouTube : déjà autorisée dans le client Google. */
const driveRedirect = () => callbackUrl("google");

export const driveConfigured = () => !!(config.google.clientId && config.google.clientSecret);
const keyOf = (uid: number) => `gdrive:${uid}`;
const uidOf = (c: Parameters<typeof currentUser>[0]) => currentUser(c)!.id;

function stored(uid: number) {
  const r = db.prepare("SELECT * FROM integrations WHERE id = ?").get(keyOf(uid)) as Record<string, any> | undefined;
  return r && { name: r.name as string | null, access: unseal(r.access_token), refresh: unseal(r.refresh_token), expiresAt: r.expires_at as number };
}

function saveTokens(uid: number, t: any, name?: string) {
  const prev = stored(uid);
  db.prepare(
    `INSERT INTO integrations (id, name, access_token, refresh_token, expires_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET name = COALESCE(excluded.name, integrations.name),
       access_token = excluded.access_token, refresh_token = excluded.refresh_token, expires_at = excluded.expires_at`,
  ).run(
    keyOf(uid),
    name ?? null,
    seal(t.access_token),
    // Google ne renvoie le refresh token qu'à la première autorisation : on garde l'ancien sinon.
    seal(t.refresh_token ?? prev?.refresh ?? ""),
    Date.now() + (t.expires_in ?? 3600) * 1000,
  );
}

const tokenRequest = (params: Record<string, string>) =>
  json(TOKEN_URL, form({ ...params, client_id: config.google.clientId!, client_secret: config.google.clientSecret! }));

const refreshing = new Map<number, Promise<string>>();

async function accessToken(uid: number): Promise<string> {
  const s = stored(uid);
  if (!s?.access) throw new Error("Google Drive n'est pas connecté.");
  if (s.expiresAt - Date.now() > 2 * 60_000) return s.access;
  if (!s.refresh) throw new Error("Accès Google Drive expiré : reconnecte Drive dans l'onglet Comptes.");
  let p = refreshing.get(uid);
  if (!p) {
    p = tokenRequest({ grant_type: "refresh_token", refresh_token: s.refresh })
      .then((t) => {
        saveTokens(uid, t);
        return t.access_token as string;
      })
      .catch((e) => {
        throw new Error(`Accès Google Drive refusé, reconnecte Drive dans l'onglet Comptes (${e instanceof Error ? e.message : e}).`);
      })
      .finally(() => refreshing.delete(uid));
    refreshing.set(uid, p);
  }
  return p;
}

const driveGet = async (uid: number, path: string) =>
  json(`${DRIVE}${path}`, { headers: { Authorization: `Bearer ${await accessToken(uid)}` } });

// ---------- connexion ----------

export const driveRoutes = new Hono();

driveRoutes.get("/oauth/gdrive/start", (c) => {
  if (!driveConfigured()) return c.text("Google n'est pas encore activé par le propriétaire.", 400);
  const state = randomId(24);
  const { verifier, challenge } = pkcePair();
  db.prepare("INSERT INTO oauth_states (state, provider, verifier, created_at, owner_id) VALUES (?, 'gdrive', ?, ?, ?)").run(
    state, verifier, Date.now(), uidOf(c),
  );
  return c.redirect(
    "https://accounts.google.com/o/oauth2/v2/auth?" +
      new URLSearchParams({
        client_id: config.google.clientId!,
        redirect_uri: driveRedirect(),
        response_type: "code",
        scope: SCOPE,
        access_type: "offline",
        prompt: "consent select_account",
        code_challenge: challenge,
        code_challenge_method: "S256",
        state,
      }),
  );
});

/**
 * Fin de la connexion Drive. Le retour de Google arrive sur l'adresse de YOUTUBE
 * (/oauth/google/callback, déjà déclarée chez Google) : server.ts reconnaît le « state » Drive et
 * appelle cette fonction. Rien de plus à déclarer chez Google pour Drive.
 */
export async function finishDriveOAuth(ownerId: number, verifier: string, code: string): Promise<string> {
  const t = await tokenRequest({ grant_type: "authorization_code", code, code_verifier: verifier, redirect_uri: driveRedirect() });
  if (!String(t.scope ?? "").includes("drive")) throw new Error("Google Drive : coche la case d'accès à tes fichiers Drive, puis recommence.");
  saveTokens(ownerId, t);
  const about = await driveGet(ownerId, "/about?fields=user(displayName,emailAddress)").catch(() => ({}));
  const name = about.user?.emailAddress ?? about.user?.displayName ?? "Google Drive";
  db.prepare("UPDATE integrations SET name = ? WHERE id = ?").run(name, keyOf(ownerId));
  return name;
}

// ---------- API (sous /api, donc réservée à la personne connectée) ----------

export const driveApi = new Hono();

driveApi.get("/status", (c) => {
  const s = stored(uidOf(c));
  return c.json({ configured: driveConfigured(), connected: !!s?.access, name: s?.name ?? null });
});

driveApi.delete("/", async (c) => {
  const s = stored(uidOf(c));
  // On retire aussi l'autorisation chez Google, pas seulement chez nous.
  if (s?.refresh || s?.access) await request(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(s.refresh || s.access!)}`, { method: "POST" }).catch(() => {});
  db.prepare("DELETE FROM integrations WHERE id = ?").run(keyOf(uidOf(c)));
  return c.json({ ok: true });
});

const ID_RE = /^[A-Za-z0-9_-]{5,200}$/;
const quote = (s: string) => s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

/**
 * Liste les images et vidéos. Sans dossier : les plus récentes de tout le Drive.
 * Avec ?folder= : le contenu de ce dossier (sous-dossiers compris). ?q= : recherche par nom.
 */
driveApi.get("/files", async (c) => {
  const folder = c.req.query("folder");
  const search = c.req.query("q")?.trim().slice(0, 100);
  const page = c.req.query("page");
  if (folder && folder !== "root" && !ID_RE.test(folder)) return c.json({ error: "Dossier invalide" }, 400);
  const media = "(mimeType contains 'image/' or mimeType contains 'video/')";
  const parts = ["trashed = false"];
  if (folder) parts.push(`'${folder}' in parents`, `(${media.slice(1, -1)} or mimeType = 'application/vnd.google-apps.folder')`);
  else parts.push(media);
  if (search) parts.push(`name contains '${quote(search)}'`);
  const q = new URLSearchParams({
    q: parts.join(" and "),
    orderBy: folder ? "folder,modifiedTime desc" : "modifiedTime desc",
    pageSize: "48",
    fields: "nextPageToken,files(id,name,mimeType,size,modifiedTime,thumbnailLink,videoMediaMetadata(durationMillis))",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
  });
  if (page) q.set("pageToken", page);
  try {
    const r = await driveGet(uidOf(c), `/files?${q}`);
    return c.json({
      next: r.nextPageToken ?? null,
      items: (r.files ?? []).map((f: any) => ({
        id: f.id,
        name: f.name,
        mime: f.mimeType,
        folder: f.mimeType === "application/vnd.google-apps.folder",
        size: f.size ? Number(f.size) : null,
        modifiedAt: Date.parse(f.modifiedTime ?? "") || null,
        // Miniature servie par Google, à durée de vie courte (aucune copie chez nous).
        thumbnail: f.thumbnailLink ?? null,
        duration: f.videoMediaMetadata?.durationMillis ? Number(f.videoMediaMetadata.durationMillis) : null,
        supported: ACCEPTED.has(f.mimeType),
      })),
    });
  } catch (e) {
    return c.json(driveError(e), 502);
  }
});

/** Erreur lisible ; si l'API Drive n'est pas activée dans le projet Google, on donne le lien direct. */
function driveError(e: unknown) {
  const msg = e instanceof Error ? e.message : "Google Drive indisponible";
  if (/has not been used|accessNotConfigured|is disabled|SERVICE_DISABLED/i.test(msg)) {
    const project = msg.match(/project[= ](\d{4,})/)?.[1];
    return {
      error: "L'API Google Drive n'est pas encore activée dans le projet Google de l'app.",
      enableUrl: `https://console.cloud.google.com/apis/library/drive.googleapis.com${project ? `?project=${project}` : ""}`,
    };
  }
  return { error: msg };
}

/** Importe des fichiers du Drive dans la médiathèque de la personne (copie directe Google → serveur). */
driveApi.post("/import", async (c) => {
  const uid = uidOf(c);
  const { ids } = await c.req.json<{ ids?: string[] }>().catch(() => ({ ids: [] as string[] }));
  if (!Array.isArray(ids) || !ids.length || ids.length > 20 || !ids.every((id) => typeof id === "string" && ID_RE.test(id)))
    return c.json({ error: "Choisis entre 1 et 20 fichiers." }, 400);
  const media = [];
  const errors: string[] = [];
  for (const id of ids) {
    let name = id;
    try {
      const meta = await driveGet(uid, `/files/${id}?fields=name,mimeType,size&supportsAllDrives=true`);
      name = meta.name ?? id;
      if (!ACCEPTED.has(meta.mimeType)) throw new Error(`format non pris en charge (${meta.mimeType})`);
      if (meta.size && Number(meta.size) > config.maxUploadBytes) throw new Error("fichier trop volumineux");
      const res = await request(`${DRIVE}/files/${id}?alt=media&supportsAllDrives=true`, { headers: { Authorization: `Bearer ${await accessToken(uid)}` } }, 30 * 60_000);
      const m = await saveUpload(res.body!, name, meta.mimeType, uid);
      media.push({ id: m.id, filename: m.filename, mime: m.mime, size: m.size, kind: m.kind, url: m.localUrl });
    } catch (e) {
      errors.push(`${name} : ${e instanceof Error ? e.message : "import impossible"}`);
    }
  }
  return c.json({ media, errors }, media.length || !errors.length ? 200 : 502);
});

// ---------- Import par lien de partage (aucune connexion, aucun réglage) ----------

/** Identifiant du fichier dans un lien Google Drive (file/d/ID, open?id=ID, uc?id=ID…). */
export function driveIdFromLink(link: string): string | null {
  let u: URL;
  try {
    u = new URL(link.trim());
  } catch {
    return null;
  }
  if (!/(^|\.)(drive|docs)\.google\.com$|^drive\.usercontent\.google\.com$/.test(u.hostname)) return null;
  const id = u.pathname.match(/\/(?:file\/d|d)\/([A-Za-z0-9_-]{10,200})/)?.[1] ?? u.searchParams.get("id");
  return id && ID_RE.test(id) ? id : null;
}

const extMime: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif",
  mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm",
};

/**
 * Importe un fichier partagé « Tous les utilisateurs disposant du lien ». Le serveur le télécharge
 * directement chez Google (adresse fixe : pas de téléchargement vers un autre site).
 */
driveApi.post("/link", async (c) => {
  const { url } = await c.req.json<{ url?: string }>().catch(() => ({ url: "" }));
  const id = driveIdFromLink(String(url ?? ""));
  if (!id) return c.json({ error: "Ce n'est pas un lien de fichier Google Drive. Dans Drive : ⋮ → Partager → Copier le lien." }, 400);
  try {
    const res = await request(`${PUBLIC_DL}/download?${new URLSearchParams({ id, export: "download", confirm: "t" })}`, { redirect: "follow" }, 30 * 60_000);
    const type = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (type.startsWith("text/html")) {
      await res.body?.cancel();
      return c.json({ error: "Fichier non accessible : dans Drive, partage-le en « Tous les utilisateurs disposant du lien » (Lecteur), puis recopie le lien." }, 400);
    }
    const cd = res.headers.get("content-disposition") ?? "";
    const name = decodeURIComponent(cd.match(/filename\*=UTF-8''([^;]+)/i)?.[1] ?? cd.match(/filename="?([^";]+)"?/i)?.[1] ?? `drive-${id}`);
    const mime = ACCEPTED.has(type) ? type : (extMime[name.split(".").pop()?.toLowerCase() ?? ""] ?? type);
    if (!ACCEPTED.has(mime)) {
      await res.body?.cancel();
      return c.json({ error: `Format non pris en charge (${name}). Formats acceptés : JPG, PNG, WebP, GIF, MP4, MOV, WebM.` }, 400);
    }
    const len = Number(res.headers.get("content-length") ?? 0);
    if (len > config.maxUploadBytes) {
      await res.body?.cancel();
      return c.json({ error: "Fichier trop volumineux." }, 400);
    }
    const m = await saveUpload(res.body!, name, mime, uidOf(c));
    return c.json({ media: [{ id: m.id, filename: m.filename, mime: m.mime, size: m.size, kind: m.kind, url: m.localUrl }] });
  } catch (e) {
    const status = (e as { status?: number }).status;
    if (status === 401 || status === 403 || status === 404)
      return c.json({ error: "Fichier introuvable ou privé : dans Drive, partage-le en « Tous les utilisateurs disposant du lien » (Lecteur), puis recopie le lien." }, 400);
    return c.json({ error: e instanceof Error ? e.message : "Téléchargement impossible" }, 502);
  }
});
