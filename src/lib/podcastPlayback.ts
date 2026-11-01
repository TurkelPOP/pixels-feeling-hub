// Position de lecture par épisode et vitesse préférée, gardées dans localStorage (jamais envoyées au serveur).

const POSITIONS_KEY = "pp_podcast_positions";
const RATE_KEY = "pp_podcast_rate";

export const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 2] as const;
/** Sous ce seuil, ou à moins de END_MARGIN_S de la fin, on repart du début. */
const MIN_RESUME_S = 10;
const END_MARGIN_S = 15;

type PositionMap = Record<string, number>;

function readPositions(): PositionMap {
  try {
    const raw = localStorage.getItem(POSITIONS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? (parsed as PositionMap) : {};
  } catch {
    return {};
  }
}

export function savePosition(guid: string, seconds: number) {
  if (typeof window === "undefined" || !guid) return;
  try {
    const positions = readPositions();
    if (seconds >= MIN_RESUME_S) positions[guid] = Math.floor(seconds);
    else delete positions[guid];
    localStorage.setItem(POSITIONS_KEY, JSON.stringify(positions));
  } catch {
    // Stockage indisponible (navigation privée, quota) : la reprise est un confort, pas un besoin.
  }
}

export function clearPosition(guid: string) {
  if (typeof window === "undefined" || !guid) return;
  try {
    const positions = readPositions();
    if (!(guid in positions)) return;
    delete positions[guid];
    localStorage.setItem(POSITIONS_KEY, JSON.stringify(positions));
  } catch {
    // voir savePosition
  }
}

/** Position à reprendre pour cet épisode, ou 0 si elle est trop proche du début ou de la fin. */
export function getResumePosition(guid: string, duration: number): number {
  if (typeof window === "undefined" || !guid) return 0;
  const saved = readPositions()[guid];
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

export function saveRate(rate: number) {
  try {
    localStorage.setItem(RATE_KEY, String(rate));
  } catch {
    // voir savePosition
  }
}

export function nextRate(rate: number): number {
  const i = (PLAYBACK_RATES as readonly number[]).indexOf(rate);
  return PLAYBACK_RATES[(i + 1) % PLAYBACK_RATES.length];
}
