import { createReadStream, createWriteStream } from "node:fs";
import { open, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

import { createHmac, timingSafeEqual } from "node:crypto";

import { config, mediaDir } from "./config.ts";
import { randomId } from "./crypto.ts";
import { db } from "./db.ts";

export interface MediaFile {
  id: string;
  filename: string;
  mime: string;
  size: number;
  kind: "image" | "video";
  path: string;
  /** URL publique signée et temporaire (24 h), que Meta/Threads téléchargent. */
  publicUrl: string;
  /** Adresse dans l'interface (nécessite d'être connecté). */
  localUrl: string;
  ownerId: number;
}

const ALLOWED: Record<string, "image" | "video"> = {
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "image",
  "image/gif": "image",
  "video/mp4": "video",
  "video/quicktime": "video",
  "video/webm": "video",
};

const ext = (mime: string) => mime.split("/")[1].replace("quicktime", "mov").replace("jpeg", "jpg");

// ---------- Liens signés ----------
// Les fichiers ne sont lisibles sans connexion qu'avec une signature valable 24 h, créée au moment
// de publier. Un brouillon n'est donc jamais accessible publiquement, même avec son adresse.

const MEDIA_KEY = createHmac("sha256", config.appSecret).update("media-links").digest();
const LINK_TTL_S = 24 * 3600;
const sign = (file: string, exp: number) => createHmac("sha256", MEDIA_KEY).update(`${file}:${exp}`).digest("base64url").slice(0, 32);

export function signedMediaUrl(file: string): string {
  const exp = Math.floor(Date.now() / 1000) + LINK_TTL_S;
  return `${config.mediaPublicUrl}/media/${file}?exp=${exp}&sig=${sign(file, exp)}`;
}

export function checkMediaSignature(file: string, exp: string | undefined, sig: string | undefined): boolean {
  const e = Number(exp);
  if (!sig || !Number.isFinite(e) || e * 1000 < Date.now() || e - Date.now() / 1000 > LINK_TTL_S + 60) return false;
  const expected = Buffer.from(sign(file, e));
  const got = Buffer.from(sig);
  return got.length === expected.length && timingSafeEqual(got, expected);
}

/** Vérifie que le contenu correspond vraiment au type annoncé (signature binaire du fichier). */
function looksLike(mime: string, head: Buffer): boolean {
  const str = (a: number, b: number) => head.toString("latin1", a, b);
  switch (mime) {
    case "image/jpeg": return head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
    case "image/png": return head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    case "image/gif": return str(0, 4) === "GIF8";
    case "image/webp": return str(0, 4) === "RIFF" && str(8, 12) === "WEBP";
    case "video/mp4":
    case "video/quicktime": return str(4, 8) === "ftyp" || str(4, 8) === "moov" || str(4, 8) === "wide" || str(4, 8) === "mdat";
    case "video/webm": return head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3;
  }
  return false;
}

export function mediaPath(id: string, mime: string): string {
  return resolve(mediaDir, `${id}.${ext(mime)}`);
}

function toMedia(r: Record<string, any>): MediaFile {
  return {
    id: r.id,
    filename: r.filename,
    mime: r.mime,
    size: r.size,
    kind: ALLOWED[r.mime],
    path: mediaPath(r.id, r.mime),
    publicUrl: signedMediaUrl(`${r.id}.${ext(r.mime)}`),
    localUrl: `/media/${r.id}.${ext(r.mime)}`,
    ownerId: r.owner_id,
  };
}

/** Enregistre un upload en streaming (pas de mise en mémoire des grosses vidéos). */
export async function saveUpload(
  body: ReadableStream<Uint8Array>,
  filename: string,
  mime: string,
  ownerId: number,
): Promise<MediaFile> {
  if (!ALLOWED[mime]) throw new Error(`Format non pris en charge : ${mime}`);
  const id = randomId(18);
  const path = mediaPath(id, mime);
  let size = 0;
  const limiter = new Transform({
    transform(chunk: Buffer, _enc, cb) {
      size += chunk.length;
      if (size > config.maxUploadBytes) cb(new Error("Fichier trop volumineux"));
      else cb(null, chunk);
    },
  });
  try {
    await pipeline(Readable.fromWeb(body as any), limiter, createWriteStream(path));
  } catch (e) {
    await unlink(path).catch(() => {});
    throw e;
  }
  if (size === 0) {
    await unlink(path).catch(() => {});
    throw new Error("Fichier vide");
  }
  const head = await readChunk(path, 0, 16);
  if (!looksLike(mime, Buffer.from(head))) {
    await unlink(path).catch(() => {});
    throw new Error(`Le contenu du fichier ne correspond pas au format ${mime}.`);
  }
  db.prepare("INSERT INTO media (id, filename, mime, size, created_at, owner_id) VALUES (?, ?, ?, ?, ?, ?)").run(
    id,
    filename.slice(0, 200),
    mime,
    size,
    Date.now(),
    ownerId,
  );
  return getMedia(id)!;
}

export function getMedia(id: string): MediaFile | undefined {
  const r = db.prepare("SELECT * FROM media WHERE id = ?").get(id) as Record<string, any> | undefined;
  return r ? toMedia(r) : undefined;
}

export function getMediaList(ids: string[], ownerId?: number): MediaFile[] {
  return ids
    .map((id) => getMedia(id))
    .filter((m): m is MediaFile => !!m && (ownerId === undefined || m.ownerId === ownerId));
}

/**
 * Supprime tout de suite, fichier compris, les médias de cette personne qu'aucun post n'utilise
 * plus (retirés de l'éditeur, post supprimé…). Un média encore utilisé par un brouillon ou un post
 * programmé est conservé.
 */
export async function purgeUnused(ids: Iterable<string>, ownerId: number): Promise<number> {
  let removed = 0;
  for (const id of new Set(ids)) {
    const m = getMedia(id);
    if (!m || m.ownerId !== ownerId) continue;
    const used = db.prepare("SELECT 1 FROM posts WHERE instr(media_ids, ?) > 0 LIMIT 1").get(`"${id}"`);
    if (used) continue;
    await unlink(mediaPath(m.id, m.mime)).catch(() => {});
    db.prepare("DELETE FROM media WHERE id = ?").run(id);
    removed++;
  }
  return removed;
}

/** Tous les médias d'une personne (suppression de son accès). */
export async function purgeAllMedia(ownerId: number): Promise<void> {
  const rows = db.prepare("SELECT id, mime FROM media WHERE owner_id = ?").all(ownerId) as { id: string; mime: string }[];
  for (const r of rows) {
    await unlink(mediaPath(r.id, r.mime)).catch(() => {});
    db.prepare("DELETE FROM media WHERE id = ?").run(r.id);
  }
}

/** Propriétaire d'un fichier média (nom « id.ext »), pour l'affichage dans l'interface. */
export function mediaOwner(file: string): number | null {
  const r = db.prepare("SELECT owner_id FROM media WHERE id = ?").get(file.split(".")[0]) as { owner_id: number } | undefined;
  return r?.owner_id ?? null;
}

/** Lit un morceau d'un fichier (uploads fragmentés X / TikTok / YouTube). */
export async function readChunk(path: string, start: number, length: number): Promise<Uint8Array<ArrayBuffer>> {
  const fh = await open(path, "r");
  try {
    const buf = new Uint8Array(length);
    const { bytesRead } = await fh.read(buf, 0, length, start);
    return buf.subarray(0, bytesRead);
  } finally {
    await fh.close();
  }
}

export const fileStream = (path: string) => Readable.toWeb(createReadStream(path)) as ReadableStream;
