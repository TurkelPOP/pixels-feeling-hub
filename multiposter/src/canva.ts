// Connecteur Canva (Connect API) : lister les designs récemment modifiés, par exemple ceux
// que ta tâche planifiée met à jour, puis les exporter en JPG/PNG/MP4 dans la médiathèque.
import { Hono } from "hono";

import { callbackUrl, config } from "./config.ts";
import { pkcePair, randomId, seal, unseal } from "./crypto.ts";
import { db } from "./db.ts";
import { form, json, postJson, request, sleep } from "./http.ts";
import { saveUpload } from "./media.ts";

const API = (process.env.CANVA_API_URL ?? "https://api.canva.com/rest/v1").replace(/\/+$/, "");
const SCOPES = "design:meta:read design:content:read profile:read";

db.exec(`CREATE TABLE IF NOT EXISTS integrations (
  id TEXT PRIMARY KEY, name TEXT, access_token TEXT, refresh_token TEXT, expires_at INTEGER
)`);

export const canvaConfigured = () => !!(config.canva.clientId && config.canva.clientSecret);

const basic = () => "Basic " + Buffer.from(`${config.canva.clientId}:${config.canva.clientSecret}`).toString("base64");

async function tokenRequest(params: Record<string, string>) {
  const init = form(params);
  (init.headers as Record<string, string>).Authorization = basic();
  return json(`${API}/oauth/token`, init);
}

function saveTokens(t: any, name?: string) {
  db.prepare(
    `INSERT INTO integrations (id, name, access_token, refresh_token, expires_at) VALUES ('canva', ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET name = COALESCE(excluded.name, integrations.name),
       access_token = excluded.access_token, refresh_token = excluded.refresh_token, expires_at = excluded.expires_at`,
  ).run(name ?? null, seal(t.access_token), seal(t.refresh_token), Date.now() + (t.expires_in ?? 14_400) * 1000);
}

function stored() {
  const r = db.prepare("SELECT * FROM integrations WHERE id = 'canva'").get() as Record<string, any> | undefined;
  return r && { name: r.name as string | null, access: unseal(r.access_token), refresh: unseal(r.refresh_token), expiresAt: r.expires_at as number };
}

let refreshing: Promise<string> | undefined;

/** Token valide (renouvelé si besoin ; Canva fait tourner le refresh token à chaque usage). */
async function accessToken(): Promise<string> {
  const s = stored();
  if (!s?.access) throw new Error("Canva n'est pas connecté.");
  if (s.expiresAt - Date.now() > 2 * 60_000) return s.access;
  refreshing ??= tokenRequest({ grant_type: "refresh_token", refresh_token: s.refresh! })
    .then((t) => {
      saveTokens(t);
      return t.access_token as string;
    })
    .finally(() => (refreshing = undefined));
  return refreshing;
}

const canvaGet = async (path: string) => json(`${API}${path}`, { headers: { Authorization: `Bearer ${await accessToken()}` } });

const FORMATS = {
  jpg: { mime: "image/jpeg", ext: "jpg", body: { type: "jpg", quality: 92 } },
  png: { mime: "image/png", ext: "png", body: { type: "png" } },
  mp4: { mime: "video/mp4", ext: "mp4", body: { type: "mp4", quality: "vertical_1080p" } as Record<string, string> },
} as const;
type Format = keyof typeof FORMATS;

/** Exporte un design (toutes les pages, dans l'ordre) et range chaque page dans la médiathèque. */
async function importDesign(designId: string, format: Format, horizontal = false) {
  const f = FORMATS[format];
  const body = format === "mp4" ? { type: "mp4", quality: horizontal ? "horizontal_1080p" : "vertical_1080p" } : f.body;
  const { design } = await canvaGet(`/designs/${encodeURIComponent(designId)}`);
  const title = (design?.title || "Canva").replace(/[\\/:*?"<>|]/g, " ").trim();

  const token = await accessToken();
  let { job } = await json(
    `${API}/exports`,
    postJson({ design_id: designId, format: body }, { Authorization: `Bearer ${token}` }),
  );
  const deadline = Date.now() + (format === "mp4" ? 10 : 3) * 60_000;
  while (job.status === "in_progress") {
    if (Date.now() > deadline) throw new Error("Canva : l'export prend trop de temps, réessaie.");
    await sleep(format === "mp4" ? 4_000 : 1_500);
    ({ job } = await canvaGet(`/exports/${job.id}`));
  }
  if (job.status !== "success") throw new Error(`Canva : export impossible (${job.error?.message ?? job.status})`);

  const urls: string[] = job.urls ?? [];
  const media = [];
  for (const [i, url] of urls.entries()) {
    const res = await request(url, {}, 5 * 60_000);
    const name = urls.length > 1 ? `${title} - ${i + 1}.${f.ext}` : `${title}.${f.ext}`;
    media.push(await saveUpload(res.body!, name, f.mime));
  }
  return media;
}

export const canvaRoutes = new Hono();

canvaRoutes.get("/oauth/canva/start", (c) => {
  if (!canvaConfigured()) return c.text("Canva non configuré (CANVA_CLIENT_ID / CANVA_CLIENT_SECRET)", 400);
  const state = randomId(24);
  const { verifier, challenge } = pkcePair();
  db.prepare("INSERT INTO oauth_states (state, provider, verifier, created_at) VALUES (?, 'canva', ?, ?)").run(
    state,
    verifier,
    Date.now(),
  );
  return c.redirect(
    "https://www.canva.com/api/oauth/authorize?" +
      new URLSearchParams({
        code_challenge: challenge,
        code_challenge_method: "s256",
        scope: SCOPES,
        response_type: "code",
        client_id: config.canva.clientId!,
        redirect_uri: callbackUrl("canva"),
        state,
      }),
  );
});

canvaRoutes.get("/oauth/canva/callback", async (c) => {
  const { state, code, error, error_description } = c.req.query();
  const row = db.prepare("DELETE FROM oauth_states WHERE state = ? AND provider = 'canva' RETURNING verifier").get(state ?? "") as
    | { verifier: string }
    | undefined;
  const back = (msg: string, ok = false) => c.redirect(`/#accounts?${ok ? "ok" : "err"}=${encodeURIComponent(msg)}`);
  if (!row) return back("Lien de connexion Canva expiré, recommence.");
  if (error || !code) return back(`Connexion Canva annulée : ${error_description ?? error ?? "pas de code"}`);
  try {
    const t = await tokenRequest({
      grant_type: "authorization_code",
      code,
      code_verifier: row.verifier,
      redirect_uri: callbackUrl("canva"),
    });
    saveTokens(t);
    const me = await canvaGet("/users/me/profile").catch(() => ({}));
    const name = me.profile?.display_name ?? "Canva";
    db.prepare("UPDATE integrations SET name = ? WHERE id = 'canva'").run(name);
    return back(`Canva connecté (${name}).`, true);
  } catch (e) {
    console.error("[oauth canva]", e);
    return back(e instanceof Error ? e.message : "Échec de la connexion Canva");
  }
});

/** Routes JSON, montées sous /api (donc protégées par le mot de passe). */
export const canvaApi = new Hono();

canvaApi.get("/status", (c) => {
  const s = stored();
  return c.json({ configured: canvaConfigured(), connected: !!s?.access, name: s?.name ?? null });
});

canvaApi.delete("/", (c) => {
  db.prepare("DELETE FROM integrations WHERE id = 'canva'").run();
  return c.json({ ok: true });
});

canvaApi.get("/designs", async (c) => {
  const q = new URLSearchParams({ sort_by: "modified_descending", ownership: "any" });
  const query = c.req.query("query")?.trim();
  if (query) q.set("query", query.slice(0, 255));
  const cont = c.req.query("continuation");
  if (cont) q.set("continuation", cont);
  try {
    const r = await canvaGet(`/designs?${q}`);
    return c.json({
      continuation: r.continuation ?? null,
      items: (r.items ?? []).map((d: any) => ({
        id: d.id,
        title: d.title || "Sans titre",
        thumbnail: d.thumbnail?.url ?? null,
        horizontal: (d.thumbnail?.width ?? 0) > (d.thumbnail?.height ?? 0),
        editUrl: d.urls?.edit_url ?? null,
        pageCount: d.page_count ?? null,
        updatedAt: (d.updated_at ?? 0) * 1000,
      })),
    });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : "Canva indisponible" }, 502);
  }
});

canvaApi.post("/designs/:id/import", async (c) => {
  const { format = "jpg", horizontal = false } = await c.req
    .json<{ format?: Format; horizontal?: boolean }>()
    .catch(() => ({ format: "jpg" as Format, horizontal: false }));
  if (!(format in FORMATS)) return c.json({ error: "Format inconnu" }, 400);
  try {
    const media = await importDesign(c.req.param("id"), format, !!horizontal);
    return c.json({
      media: media.map((m) => ({ id: m.id, filename: m.filename, mime: m.mime, size: m.size, kind: m.kind, url: `/media/${m.publicUrl.split("/").pop()}` })),
    });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : "Import impossible" }, 502);
  }
});
