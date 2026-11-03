import type { Account, AccountInput, Provider } from "../db.ts";
import type { MediaFile } from "../media.ts";

export interface PublishInput {
  account: Account;
  text: string;
  /** Titre (YouTube ; sinon ignoré). */
  title: string;
  media: MediaFile[];
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
  validate(input: { text: string; media: MediaFile[]; viaZernio?: boolean }): string | null;
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
export const videos = (m: MediaFile[]) => m.filter((x) => x.kind === "video");
