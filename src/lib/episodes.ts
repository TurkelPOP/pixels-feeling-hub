// Identifiants d'URL des épisodes : `<titre-simplifié>-<empreinte>`. Pur, sans import serveur.
import type { Episode } from "./podcast.functions";

const MAX_TITLE_SLUG = 60;

/** Empreinte courte et stable du guid (FNV-1a, 8 hex) : fonctionne même si le guid est une URL. */
function shortId(guid: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < guid.length; i++) {
    h ^= guid.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function slugify(title: string): string {
  const slug = title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " et ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_TITLE_SLUG)
    .replace(/-+$/, "");
  return slug || "episode";
}

export function episodeSlug(ep: Pick<Episode, "guid" | "title">): string {
  return `${slugify(ep.title)}-${shortId(ep.guid)}`;
}

export function episodePath(ep: Pick<Episode, "guid" | "title">): string {
  return `/episode/${episodeSlug(ep)}`;
}

/** Retrouve l'épisode grâce à l'empreinte finale, pour que l'URL survive à un titre modifié. */
export function findEpisodeBySlug(episodes: Episode[], slug: string): Episode | undefined {
  const id = slug.slice(slug.lastIndexOf("-") + 1);
  if (!/^[0-9a-f]{8}$/.test(id)) return undefined;
  return episodes.find((ep) => shortId(ep.guid) === id);
}

/** ISO 8601 (PT1H34M32S) pour les données structurées. */
export function isoDuration(totalSeconds: number | undefined): string | undefined {
  if (!totalSeconds || totalSeconds <= 0) return undefined;
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  return `PT${h ? `${h}H` : ""}${m ? `${m}M` : ""}${s || (!h && !m) ? `${s}S` : ""}`;
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(" ") > max * 0.6 ? cut.lastIndexOf(" ") : cut.length)}…`;
}

export type TextPart = { text: string; href?: string };

const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"']+/gi;
const TRAILING_PUNCTUATION = /[.,;:!?)\]]+$/;

/**
 * Découpe un texte en morceaux, les adresses http(s) et www. devenant des liens.
 * La ponctuation finale (point, virgule, parenthèse) reste hors du lien.
 */
export function linkify(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_RE)) {
    const raw = match[0];
    const start = match.index ?? 0;
    const trailing = raw.match(TRAILING_PUNCTUATION)?.[0] ?? "";
    const label = raw.slice(0, raw.length - trailing.length);
    const href = label.toLowerCase().startsWith("www.") ? `https://${label}` : label;

    let valid = label.length > 0;
    if (valid) {
      try {
        const { protocol } = new URL(href);
        valid = protocol === "http:" || protocol === "https:";
      } catch {
        valid = false;
      }
    }

    if (start > last) parts.push({ text: text.slice(last, start) });
    if (valid) {
      parts.push({ text: label, href });
      if (trailing) parts.push({ text: trailing });
    } else {
      parts.push({ text: raw });
    }
    last = start + raw.length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}
