import type { Account, AccountInput, Provider } from "../db.ts";
import type { MediaFile } from "../media.ts";

/** Options de publication propres à un réseau, choisies dans l'éditeur. */
export interface TargetOptions {
  /** Médias envoyés à ce réseau (ids, dans l'ordre du post). Absent = tous les médias. */
  media?: string[];
  /** Instagram : publication normale (post, carrousel, Reel) ou story. */
  format?: "feed" | "story";
  /** Instagram : publier aussi le 1er média en story. */
  alsoStory?: boolean;
  /** YouTube : titre de la vidéo. */
  title?: string;
  /** YouTube (public, unlisted, private) ou TikTok (PUBLIC_TO_EVERYONE…). */
  privacy?: string;
  /** TikTok : interactions autorisées. */
  allowComment?: boolean;
  allowDuet?: boolean;
  allowStitch?: boolean;
}

const PRIVACY = new Set(["public", "unlisted", "private", "PUBLIC_TO_EVERYONE", "MUTUAL_FOLLOW_FRIENDS", "FOLLOWER_OF_CREATOR", "SELF_ONLY"]);

/** Ne garde que des options valides (les données viennent du navigateur). */
export function sanitizeOptions(raw: unknown): TargetOptions {
  if (!raw || typeof raw !== "object") return {};
  const r = raw as Record<string, unknown>;
  const o: TargetOptions = {};
  if (Array.isArray(r.media)) o.media = r.media.filter((x): x is string => typeof x === "string").slice(0, 20);
  if (r.format === "feed" || r.format === "story") o.format = r.format;
  if (typeof r.alsoStory === "boolean") o.alsoStory = r.alsoStory;
  if (typeof r.title === "string" && r.title.trim()) o.title = r.title.trim().slice(0, 100);
  if (typeof r.privacy === "string" && PRIVACY.has(r.privacy)) o.privacy = r.privacy;
  for (const k of ["allowComment", "allowDuet", "allowStitch"] as const) if (typeof r[k] === "boolean") o[k] = r[k] as boolean;
  return o;
}

/** Médias réellement envoyés à un réseau, selon ses options. */
export function effectiveMedia(all: MediaFile[], o?: TargetOptions): MediaFile[] {
  if (!o?.media) return all;
  const keep = new Set(o.media);
  return all.filter((m) => keep.has(m.id));
}

export interface PublishInput {
  account: Account;
  text: string;
  /** Titre (YouTube ; sinon ignoré). */
  title: string;
  media: MediaFile[];
  options: TargetOptions;
}

export interface PublishResult {
  url?: string;
}

/** Un réseau sur lequel on publie. */
export interface Publisher {
  id: Provider;
  label: string;
  maxText: number;
  /** Renvoie un message d'erreur si le contenu ne convient pas à ce réseau. */
  validate(input: { text: string; media: MediaFile[]; options: TargetOptions }): string | null;
  publish(input: PublishInput): Promise<PublishResult>;
  /** Renouvelle les tokens si nécessaire. */
  refresh?(account: Account): Promise<{ accessToken: string; refreshToken?: string | null; expiresAt: number | null }>;
  /** Marge avant expiration à partir de laquelle on renouvelle (ms). */
  refreshMarginMs?: number;
}

/** Un parcours de connexion OAuth (Meta connecte Facebook + Instagram d'un coup). */
export interface OAuthFlow {
  id: string;
  label: string;
  providers: Provider[];
  configured(): boolean;
  usesPkce?: boolean;
  authorizeUrl(state: string, pkceChallenge: string): string;
  callback(code: string, pkceVerifier: string | null): Promise<AccountInput[]>;
}

export function countChars(text: string): number {
  return [...new Intl.Segmenter().segment(text)].length;
}

export const images = (m: MediaFile[]) => m.filter((x) => x.kind === "image");
/** Vidéo que ce réseau n'accepte pas (WebM, enregistré par certaines webcams). */
export const hasWebm = (m: MediaFile[]) => m.some((x) => x.kind === "video" && x.mime !== "video/mp4" && x.mime !== "video/quicktime");
export const videos = (m: MediaFile[]) => m.filter((x) => x.kind === "video");
