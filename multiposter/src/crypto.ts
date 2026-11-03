import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import { config } from "./config.ts";

const key = createHash("sha256").update(`tokens:${config.appSecret}`).digest();

/** Chiffre une chaîne (AES-256-GCM) pour stocker les tokens OAuth au repos. */
export function seal(plain: string | null | undefined): string | null {
  if (plain == null) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString("base64");
}

export function unseal(sealed: string | null | undefined): string | null {
  if (!sealed) return null;
  const buf = Buffer.from(sealed, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString("utf8");
}

export const randomId = (bytes = 12) => randomBytes(bytes).toString("base64url");

export function pkcePair() {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}
