import { createReadStream, createWriteStream } from "node:fs";
import { open, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

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
  /** URL publique (non devinable) que Meta/Threads téléchargent. */
  publicUrl: string;
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
    publicUrl: `${config.mediaPublicUrl}/media/${r.id}.${ext(r.mime)}`,
  };
}

/** Enregistre un upload en streaming (pas de mise en mémoire des grosses vidéos). */
export async function saveUpload(
  body: ReadableStream<Uint8Array>,
  filename: string,
  mime: string,
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
  db.prepare("INSERT INTO media (id, filename, mime, size, created_at) VALUES (?, ?, ?, ?, ?)").run(
    id,
    filename.slice(0, 200),
    mime,
    size,
    Date.now(),
  );
  return getMedia(id)!;
}

export function getMedia(id: string): MediaFile | undefined {
  const r = db.prepare("SELECT * FROM media WHERE id = ?").get(id) as Record<string, any> | undefined;
  return r ? toMedia(r) : undefined;
}

export function getMediaList(ids: string[]): MediaFile[] {
  return ids.map((id) => getMedia(id)).filter((m): m is MediaFile => !!m);
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
