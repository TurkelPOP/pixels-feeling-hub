// Prochain live d'après le planning Twitch. Pur, sans import serveur, pour pouvoir le tester.

export interface HelixScheduleSegment {
  start_time: string;
  end_time?: string | null;
  title?: string;
  canceled_until?: string | null;
  category?: { name?: string } | null;
}

export interface NextStream {
  startTime: string;
  endTime?: string;
  title?: string;
  gameName?: string;
}

/**
 * Premier créneau à venir, hors créneaux annulés. Un créneau récurrent annulé renvoie
 * `canceled_until` : on le saute plutôt que d'afficher une date où il n'y aura pas de live.
 */
export function pickNextStream(
  segments: HelixScheduleSegment[] | undefined,
  now = Date.now(),
): NextStream | undefined {
  const next = (segments ?? [])
    .filter((s) => {
      const start = Date.parse(s.start_time);
      return Number.isFinite(start) && start > now && !s.canceled_until;
    })
    .sort((a, b) => Date.parse(a.start_time) - Date.parse(b.start_time))[0];
  if (!next) return undefined;
  return {
    startTime: next.start_time,
    endTime: next.end_time || undefined,
    title: next.title?.trim() || undefined,
    gameName: next.category?.name?.trim() || undefined,
  };
}

/** « Dans 2 j 4 h », « Dans 3 h 12 min », « Dans 12 min », « Dans quelques instants ». */
export function formatCountdown(startTime: string, now = Date.now()): string {
  const ms = Date.parse(startTime) - now;
  if (!Number.isFinite(ms) || ms <= 0) return "";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "Dans quelques instants";
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  if (days > 0) return `Dans ${days} j${hours ? ` ${hours} h` : ""}`;
  if (hours > 0) return `Dans ${hours} h${mins ? ` ${String(mins).padStart(2, "0")} min` : ""}`;
  return `Dans ${mins} min`;
}
