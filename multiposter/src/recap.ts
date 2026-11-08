// Récap du matin : chaque jour, à l'heure choisie par chaque personne, une notification résume
// sa journée (posts programmés aujourd'hui, brouillons en attente, échecs de la veille).
// Le propriétaire le reçoit aussi sur le webhook d'alertes (Discord…), pour son propre espace.
import type { Context, Hono } from "hono";

import { alert } from "./alerts.ts";
import { currentUser, ownerId } from "./auth.ts";
import { config } from "./config.ts";
import { db } from "./db.ts";
import { notify } from "./push.ts";

interface RecapPrefs { enabled: boolean; hour: number }
const DEFAULT: RecapPrefs = { enabled: true, hour: 8 };

function prefs(uid: number): RecapPrefs {
  const r = db.prepare("SELECT value FROM settings WHERE key = ?").get(`recap:${uid}`) as { value: string } | undefined;
  try { return { ...DEFAULT, ...(r ? JSON.parse(r.value) : {}) }; } catch { return DEFAULT; }
}

/** Heure et jour dans le fuseau de l'app. */
function local(ms = Date.now()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: config.timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(ms);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return { day: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) };
}
const hhmm = (ms: number) => new Intl.DateTimeFormat("fr-FR", { timeZone: config.timezone, hour: "2-digit", minute: "2-digit" }).format(ms);

/** Contenu du récap d'une personne. */
export function buildRecap(uid: number, now = Date.now()) {
  const today = local(now).day;
  const scheduled = (db.prepare("SELECT id, text, scheduled_at FROM posts WHERE owner_id = ? AND status = 'scheduled' AND scheduled_at > ? AND scheduled_at < ? ORDER BY scheduled_at")
    .all(uid, now - 3600e3, now + 36 * 3600e3) as { id: number; text: string; scheduled_at: number }[])
    .filter((p) => local(p.scheduled_at).day === today);
  const drafts = (db.prepare("SELECT COUNT(*) AS n FROM posts WHERE owner_id = ? AND status = 'draft'").get(uid) as { n: number }).n;
  const failed = db.prepare(
    `SELECT COUNT(DISTINCT p.id) AS n FROM posts p JOIN post_targets t ON t.post_id = p.id
     WHERE p.owner_id = ? AND t.status = 'failed' AND p.updated_at > ?`,
  ).get(uid, now - 26 * 3600e3) as { n: number };
  const lines: string[] = [];
  lines.push(scheduled.length
    ? `📅 ${scheduled.length} post${scheduled.length > 1 ? "s" : ""} aujourd'hui : ${scheduled.slice(0, 4).map((p) => `${hhmm(p.scheduled_at)} ${(p.text.split("\n")[0] || "sans texte").slice(0, 30)}`).join(" · ")}${scheduled.length > 4 ? "…" : ""}`
    : "📅 Rien de programmé aujourd'hui.");
  if (drafts) lines.push(`📝 ${drafts} brouillon${drafts > 1 ? "s" : ""} à relire.`);
  if (failed.n) lines.push(`⚠️ ${failed.n} post${failed.n > 1 ? "s" : ""} en échec depuis hier.`);
  return { title: "☀️ Récap du jour · PTZ Posting", body: lines.join("\n"), empty: !scheduled.length && !drafts && !failed.n };
}

/** Envoie les récaps dus (appelé régulièrement ; une seule fois par jour et par personne). */
export async function sendDueRecaps(now = Date.now()) {
  const { day, hour } = local(now);
  const users = db.prepare("SELECT id, name FROM users").all() as { id: number; name: string }[];
  for (const u of users) {
    const p = prefs(u.id);
    if (!p.enabled || hour < p.hour) continue;
    const sentKey = `recap_sent:${u.id}`;
    const sent = db.prepare("SELECT value FROM settings WHERE key = ?").get(sentKey) as { value: string } | undefined;
    if (sent?.value === day) continue;
    // Trop tard dans la journée (serveur arrêté le matin) : on ne rattrape pas un récap de 8 h à 20 h.
    if (hour > p.hour + 3) { db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value").run(sentKey, day); continue; }
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value").run(sentKey, day);
    const r = buildRecap(u.id, now);
    await notify(u.id, { title: r.title, body: r.body, url: "/#queue", tag: "recap" });
    if (u.id === ownerId()) void alert(`${r.title}\n${r.body}`);
  }
}

export function startRecaps() {
  setInterval(() => void sendDueRecaps().catch((e) => console.error("[récap]", e)), 5 * 60_000).unref?.();
}

export function registerRecapApi(api: Hono) {
  const uid = (c: Context) => currentUser(c)!.id;
  api.get("/recap", (c) => c.json({ ...prefs(uid(c)), preview: buildRecap(uid(c)) }));
  api.put("/recap", async (c) => {
    const b = await c.req.json<Partial<RecapPrefs>>().catch(() => ({}) as Partial<RecapPrefs>);
    const p = { enabled: b.enabled !== false, hour: Math.min(23, Math.max(0, Math.round(Number(b.hour ?? 8)))) };
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value").run(`recap:${uid(c)}`, JSON.stringify(p));
    return c.json(p);
  });
  api.post("/recap/test", async (c) => {
    const r = buildRecap(uid(c));
    await notify(uid(c), { title: r.title, body: r.body, url: "/#queue", tag: "recap" });
    return c.json({ ok: true, ...r });
  });
}
