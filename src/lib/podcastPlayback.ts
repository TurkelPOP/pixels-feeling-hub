// Position de lecture par épisode et vitesse préférée, gardées dans localStorage.
// Chaque valeur porte sa date de modification : c'est ce qui permet de les fusionner entre appareils
// (le plus récent gagne) quand l'utilisateur est connecté et que la synchronisation est active.
import { mergeSync, sanitizePayload, type PositionEntry, type RateEntry } from "./sync.merge";

const POSITIONS_KEY = "pp_podcast_positions";
const RATE_KEY = "pp_podcast_rate";
const RATE_AT_KEY = "pp_podcast_rate_at";
const MAX_LOCAL_POSITIONS = 1000;

export const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 2] as const;
/** Sous ce seuil, ou à moins de END_MARGIN_S de la fin, on repart du début. */
const MIN_RESUME_S = 10;
const END_MARGIN_S = 15;

/** Un changement local à envoyer au serveur (écouté par le moteur de synchronisation). */
export const SYNC_DIRTY_EVENT = "pp-sync-dirty";
/** La vitesse a changé (localement ou après une synchronisation). */
export const RATE_CHANGE_EVENT = "pp-rate-change";

type PositionMap = Record<string, PositionEntry>;

function emit(name: string) {
  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
    window.dispatchEvent(new Event(name));
  }
}

function readPositions(): PositionMap {
  try {
    const raw = localStorage.getItem(POSITIONS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== "object") return {};
    const positions: PositionMap = {};
    for (const [guid, value] of Object.entries(parsed as Record<string, unknown>)) {
      // Ancien format : un nombre de secondes sans date, considéré comme le plus ancien possible.
      if (typeof value === "number" && Number.isFinite(value)) positions[guid] = { s: value, t: 0 };
      else if (value && typeof value === "object") {
        const { s, t } = value as Partial<PositionEntry>;
        if (typeof s === "number" && Number.isFinite(s) && typeof t === "number" && Number.isFinite(t)) {
          positions[guid] = { s, t };
        }
      }
    }
    return positions;
  } catch {
    return {};
  }
}

function writePositions(positions: PositionMap) {
  let entries = Object.entries(positions);
  if (entries.length > MAX_LOCAL_POSITIONS) {
    entries = entries.sort((a, b) => b[1].t - a[1].t).slice(0, MAX_LOCAL_POSITIONS);
  }
  localStorage.setItem(POSITIONS_KEY, JSON.stringify(Object.fromEntries(entries)));
}

export function savePosition(guid: string, seconds: number) {
  if (typeof window === "undefined" || !guid) return;
  try {
    const positions = readPositions();
    const now = Date.now();
    if (seconds >= MIN_RESUME_S) {
      positions[guid] = { s: Math.floor(seconds), t: now };
    } else if (positions[guid] && positions[guid].s > 0) {
      // Remise à zéro : on garde une trace datée, sinon un autre appareil ressusciterait l'ancienne position.
      positions[guid] = { s: 0, t: now };
    } else {
      return;
    }
    writePositions(positions);
    emit(SYNC_DIRTY_EVENT);
  } catch {
    // Stockage indisponible (navigation privée, quota) : la reprise est un confort, pas un besoin.
  }
}

export function clearPosition(guid: string) {
  if (typeof window === "undefined" || !guid) return;
  try {
    const positions = readPositions();
    if (!positions[guid] || positions[guid].s === 0) return;
    positions[guid] = { s: 0, t: Date.now() };
    writePositions(positions);
    emit(SYNC_DIRTY_EVENT);
  } catch {
    // voir savePosition
  }
}

/** Position à reprendre pour cet épisode, ou 0 si elle est trop proche du début ou de la fin. */
export function getResumePosition(guid: string, duration: number): number {
  if (typeof window === "undefined" || !guid) return 0;
  const saved = readPositions()[guid]?.s;
  if (typeof saved !== "number" || !Number.isFinite(saved)) return 0;
  if (saved < MIN_RESUME_S) return 0;
  if (duration > 0 && saved > duration - END_MARGIN_S) return 0;
  return saved;
}

export function loadRate(): number {
  if (typeof window === "undefined") return 1;
  try {
    const rate = Number(localStorage.getItem(RATE_KEY));
    return (PLAYBACK_RATES as readonly number[]).includes(rate) ? rate : 1;
  } catch {
    return 1;
  }
}

function readRate(): RateEntry | undefined {
  try {
    const raw = localStorage.getItem(RATE_KEY);
    if (raw === null) return undefined;
    const v = Number(raw);
    if (!(PLAYBACK_RATES as readonly number[]).includes(v)) return undefined;
    const t = Number(localStorage.getItem(RATE_AT_KEY));
    return { v, t: Number.isFinite(t) ? t : 0 };
  } catch {
    return undefined;
  }
}

export function saveRate(rate: number) {
  try {
    localStorage.setItem(RATE_KEY, String(rate));
    localStorage.setItem(RATE_AT_KEY, String(Date.now()));
  } catch {
    // voir savePosition
  }
  emit(RATE_CHANGE_EVENT);
  emit(SYNC_DIRTY_EVENT);
}

export function nextRate(rate: number): number {
  const i = (PLAYBACK_RATES as readonly number[]).indexOf(rate);
  return PLAYBACK_RATES[(i + 1) % PLAYBACK_RATES.length];
}

/** Positions et vitesse locales, au format de synchronisation (entrées invalides écartées). */
export function readPlaybackForSync() {
  const { positions, rate } = sanitizePayload({ positions: readPositions(), history: {}, rate: readRate() });
  return { positions, rate };
}

/**
 * Applique l'état renvoyé par le serveur : on fusionne avec le local (le plus récent gagne) plutôt que
 * de l'écraser, pour ne rien perdre de ce qui a été écouté pendant l'échange. N'émet pas de « dirty ».
 */
export function applyPlaybackFromSync(remote: { positions: PositionMap; rate?: RateEntry }) {
  try {
    const local = readPlaybackForSync();
    const merged = mergeSync(
      { positions: local.positions, history: {}, ...(local.rate ? { rate: local.rate } : {}) },
      { positions: remote.positions, history: {}, ...(remote.rate ? { rate: remote.rate } : {}) },
    );
    writePositions(merged.positions);
    if (merged.rate && merged.rate.v !== loadRate()) {
      localStorage.setItem(RATE_KEY, String(merged.rate.v));
      localStorage.setItem(RATE_AT_KEY, String(merged.rate.t));
      emit(RATE_CHANGE_EVENT);
    } else if (merged.rate) {
      localStorage.setItem(RATE_AT_KEY, String(merged.rate.t));
    }
  } catch {
    // Stockage indisponible : la synchronisation reprendra à la prochaine ouverture.
  }
}
