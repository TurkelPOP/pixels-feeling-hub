// Musique sur les slides : chaque personne garde sa bibliothèque de musiques (MP3, M4A, WAV…), et
// l'app transforme des slides (images) en courtes vidéos avec cette musique, grâce à ffmpeg.
// Un carrousel Instagram peut mélanger images et vidéos : le son des vidéos est joué au défilement.
// La musique doit être à toi ou libre de droits (la bibliothèque musicale d'Instagram n'est pas
// accessible aux autres apps).
import { execFile } from "node:child_process";
import { createReadStream, createWriteStream, mkdirSync } from "node:fs";
import { open, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

import type { Context, Hono } from "hono";

import { currentUser } from "./auth.ts";
import { config } from "./config.ts";
import { randomId } from "./crypto.ts";
import { db } from "./db.ts";
import { getMedia, mediaPath, saveUpload, STORAGE_FULL, storageRoom } from "./media.ts";

const FFMPEG = process.env.FFMPEG_PATH?.trim() || "ffmpeg";
const FFPROBE = process.env.FFPROBE_PATH?.trim() || "ffprobe";
const MAX_MUSIC_BYTES = 20 * 1024 * 1024;
export const musicDir = resolve(config.dataDir, "music");
const tmpDir = resolve(config.dataDir, "tmp");
mkdirSync(musicDir, { recursive: true });
mkdirSync(tmpDir, { recursive: true });

db.exec(`CREATE TABLE IF NOT EXISTS music_tracks (
  id TEXT PRIMARY KEY, owner_id INTEGER NOT NULL, name TEXT NOT NULL, mime TEXT NOT NULL,
  size INTEGER NOT NULL, duration REAL, created_at INTEGER NOT NULL
)`);

const AUDIO: Record<string, string> = {
  "audio/mpeg": "mp3", "audio/mp3": "mp3", "audio/mp4": "m4a", "audio/x-m4a": "m4a", "audio/m4a": "m4a",
  "audio/aac": "aac", "audio/wav": "wav", "audio/x-wav": "wav", "audio/wave": "wav",
};

/** Vérifie que le contenu ressemble vraiment à un fichier audio du type annoncé. */
function looksLikeAudio(ext: string, h: Buffer): boolean {
  const s = (a: number, b: number) => h.toString("latin1", a, b);
  if (ext === "mp3") return s(0, 3) === "ID3" || (h[0] === 0xff && (h[1] & 0xe0) === 0xe0);
  if (ext === "m4a") return s(4, 8) === "ftyp";
  if (ext === "aac") return h[0] === 0xff && (h[1] & 0xf6) === 0xf0;
  if (ext === "wav") return s(0, 4) === "RIFF" && s(8, 12) === "WAVE";
  return false;
}

const run = (cmd: string, args: string[], timeoutMs: number) =>
  new Promise<string>((ok, ko) =>
    execFile(cmd, args, { timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024 }, (err, stdout, stderr) =>
      err ? ko(new Error(String(stderr || err.message).trim().split("\n").slice(-3).join(" ").slice(0, 400))) : ok(stdout),
    ),
  );

let ffmpegOk: Promise<boolean> | null = null;
/** ffmpeg est-il installé sur le serveur ? (vérifié une fois) */
export const ffmpegAvailable = () => (ffmpegOk ??= run(FFMPEG, ["-version"], 10_000).then(() => true, () => false));

async function probeDuration(path: string): Promise<number | null> {
  try {
    const out = await run(FFPROBE, ["-v", "error", "-protocol_whitelist", "file", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", path], 20_000);
    const d = Number(out.trim());
    return Number.isFinite(d) && d > 0 ? Math.round(d * 10) / 10 : null;
  } catch {
    return null;
  }
}

const trackPath = (id: string, mime: string) => resolve(musicDir, `${id}.${AUDIO[mime] ?? "bin"}`);
const uid = (c: Context) => currentUser(c)!.id;

/** Fichier d'une musique, seulement pour sa propriétaire ou son propriétaire. */
export function musicFile(id: string, owner: number): { path: string; mime: string } | null {
  const r = db.prepare("SELECT id, mime FROM music_tracks WHERE id = ? AND owner_id = ?").get(id, owner) as { id: string; mime: string } | undefined;
  return r ? { path: trackPath(r.id, r.mime), mime: r.mime === "audio/mp3" ? "audio/mpeg" : r.mime } : null;
}

export async function removeMusicData(owner: number) {
  const rows = db.prepare("SELECT id, mime FROM music_tracks WHERE owner_id = ?").all(owner) as { id: string; mime: string }[];
  for (const r of rows) await unlink(trackPath(r.id, r.mime)).catch(() => {});
  db.prepare("DELETE FROM music_tracks WHERE owner_id = ?").run(owner);
}

/** Une image + un morceau de musique → une vidéo MP4 compatible Instagram (H.264/AAC, 30 i/s). */
async function slideToVideo(image: string, audio: string, start: number, seconds: number, fade: number, out: string) {
  await run(FFMPEG, [
    "-y", "-hide_banner", "-loglevel", "error",
    // Fichiers locaux uniquement : ffmpeg ne doit jamais suivre une adresse cachée dans un fichier.
    "-protocol_whitelist", "file",
    "-loop", "1", "-framerate", "30", "-i", image,
    "-protocol_whitelist", "file",
    "-ss", String(start), "-i", audio,
    "-map", "0:v", "-map", "1:a",
    "-vf", "scale='trunc(min(1080,iw)/2)*2':-2,setsar=1,format=yuv420p",
    "-af", `apad,afade=t=in:st=0:d=${fade},afade=t=out:st=${Math.max(0, seconds - fade * 2)}:d=${fade * 2}`,
    "-t", String(seconds),
    "-c:v", "libx264", "-preset", "veryfast", "-tune", "stillimage", "-crf", "20", "-r", "30",
    "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
    "-movflags", "+faststart", out,
  ], 3 * 60_000);
}

export function registerMusicApi(api: Hono) {
  api.get("/music", async (c) => {
    const tracks = (db.prepare("SELECT * FROM music_tracks WHERE owner_id = ? ORDER BY created_at DESC").all(uid(c)) as Record<string, any>[]).map((t) => ({
      id: t.id, name: t.name, duration: t.duration, size: t.size,
    }));
    return c.json({ available: await ffmpegAvailable(), tracks });
  });

  api.put("/music", async (c) => {
    const owner = uid(c);
    const mime = (c.req.header("content-type") ?? "").split(";")[0].trim().toLowerCase();
    const ext = AUDIO[mime];
    if (!ext) return c.json({ error: "Format de musique non pris en charge : MP3, M4A, AAC ou WAV." }, 400);
    if (!c.req.raw.body) return c.json({ error: "Fichier vide" }, 400);
    const n = (db.prepare("SELECT COUNT(*) AS n FROM music_tracks WHERE owner_id = ?").get(owner) as { n: number }).n;
    if (n >= 20) return c.json({ error: "20 musiques maximum : supprimes-en une." }, 400);
    const room = storageRoom(owner);
    if (room <= 0) return c.json({ error: STORAGE_FULL }, 400);
    const max = Math.min(MAX_MUSIC_BYTES, room);
    const id = randomId(18);
    const path = trackPath(id, mime);
    let size = 0;
    const limiter = new Transform({
      transform(chunk: Buffer, _e, cb) {
        size += chunk.length;
        cb(size > max ? new Error(max < MAX_MUSIC_BYTES ? STORAGE_FULL : "Musique trop lourde (20 Mo maximum).") : null, chunk);
      },
    });
    try {
      await pipeline(Readable.fromWeb(c.req.raw.body as any), limiter, createWriteStream(path));
      const fh = await open(path, "r");
      const head = Buffer.alloc(16);
      await fh.read(head, 0, 16, 0);
      await fh.close();
      if (!size || !looksLikeAudio(ext, head)) throw new Error("Le contenu du fichier n'est pas un fichier audio valide.");
    } catch (e) {
      await unlink(path).catch(() => {});
      return c.json({ error: e instanceof Error ? e.message : "Envoi impossible" }, 400);
    }
    const name = (c.req.query("filename") ?? "Musique").replace(/\.[a-z0-9]+$/i, "").slice(0, 120) || "Musique";
    const duration = await probeDuration(path);
    db.prepare("INSERT INTO music_tracks (id, owner_id, name, mime, size, duration, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
      id, owner, name, mime, size, duration, Date.now(),
    );
    return c.json({ id, name, duration, size });
  });

  api.delete("/music/:id", async (c) => {
    const f = musicFile(c.req.param("id"), uid(c));
    if (!f) return c.json({ error: "Musique introuvable" }, 404);
    await unlink(f.path).catch(() => {});
    const del = db.prepare("DELETE FROM music_tracks WHERE id = ? AND owner_id = ?").run(c.req.param("id"), uid(c));
    return del.changes ? c.json({ ok: true }) : c.json({ error: "Introuvable" }, 404);
  });

  /**
   * Transforme des slides en vidéos avec la musique.
   * mode "first" : seule la 1re image ; mode "all" : chaque image, la musique continuant d'une
   * slide à l'autre (slide 2 = la suite de la slide 1…).
   */
  api.post("/music/render", async (c) => {
    const owner = uid(c);
    if (!(await ffmpegAvailable())) return c.json({ error: "ffmpeg n'est pas installé sur le serveur : impossible de créer les vidéos." }, 501);
    const b = await c.req.json<{ mediaIds?: string[]; trackId?: string; mode?: string; seconds?: number; start?: number }>().catch(() => ({}) as Record<string, any>);
    const track = musicFile(String(b.trackId ?? ""), owner);
    if (!track) return c.json({ error: "Choisis une musique." }, 400);
    const mode = b.mode === "all" ? "all" : "first";
    const seconds = Math.min(60, Math.max(3, Math.round(Number(b.seconds) || (mode === "all" ? 5 : 15))));
    const start = Math.max(0, Number(b.start) || 0);
    const images = (Array.isArray(b.mediaIds) ? b.mediaIds : [])
      .map((id) => getMedia(String(id)))
      .filter((m) => m && m.ownerId === owner && m.kind === "image" && m.mime !== "image/gif")
      .slice(0, mode === "all" ? 10 : 1);
    if (!images.length) return c.json({ error: "Aucune image à transformer (JPG, PNG ou WebP)." }, 400);

    const results = [];
    for (const [i, m] of images.entries()) {
      const out = resolve(tmpDir, `${randomId(12)}.mp4`);
      try {
        await slideToVideo(mediaPath(m!.id, m!.mime), track.path, start + (mode === "all" ? i * seconds : 0), seconds, mode === "all" ? 0.15 : 0.5, out);
        const v = await saveUpload(Readable.toWeb(createReadStream(out)) as ReadableStream<Uint8Array>, m!.filename.replace(/\.[a-z0-9]+$/i, "") + " ♫.mp4", "video/mp4", owner);
        results.push({ replaces: m!.id, id: v.id, filename: v.filename, mime: v.mime, size: v.size, kind: v.kind, url: v.localUrl });
      } catch (e) {
        return c.json({ error: `Création de la vidéo impossible (${e instanceof Error ? e.message : e}).`, media: results }, 500);
      } finally {
        await unlink(out).catch(() => {});
      }
    }
    return c.json({ media: results });
  });
}
