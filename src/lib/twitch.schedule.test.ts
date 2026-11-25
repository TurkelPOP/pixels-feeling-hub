import { describe, expect, it } from "vitest";

import { formatCountdown, pickNextStream } from "./twitch.schedule";

const NOW = Date.parse("2026-11-02T12:00:00Z");
const at = (hours: number) => new Date(NOW + hours * 3_600_000).toISOString();

describe("pickNextStream", () => {
  it("choisit le premier créneau à venir, même si la liste est désordonnée", () => {
    const next = pickNextStream(
      [
        { start_time: at(48), title: "Plus tard" },
        { start_time: at(5), title: " Podcast live ", category: { name: "Just Chatting" } },
      ],
      NOW,
    );
    expect(next).toEqual({
      startTime: at(5),
      endTime: undefined,
      title: "Podcast live",
      gameName: "Just Chatting",
    });
  });

  it("ignore les créneaux passés et annulés", () => {
    expect(
      pickNextStream(
        [
          { start_time: at(-3) },
          { start_time: at(2), canceled_until: at(10) },
          { start_time: at(30), title: "Ok" },
        ],
        NOW,
      )?.title,
    ).toBe("Ok");
  });

  it("renvoie undefined sans planning ou sans créneau valide", () => {
    expect(pickNextStream(undefined, NOW)).toBeUndefined();
    expect(pickNextStream([], NOW)).toBeUndefined();
    expect(pickNextStream([{ start_time: "pas une date" }], NOW)).toBeUndefined();
  });
});

describe("formatCountdown", () => {
  it("formate les durées selon l'échelle", () => {
    expect(formatCountdown(at(52), NOW)).toBe("Dans 2 j 4 h");
    expect(formatCountdown(at(48), NOW)).toBe("Dans 2 j");
    expect(formatCountdown(new Date(NOW + (3 * 60 + 5) * 60_000).toISOString(), NOW)).toBe("Dans 3 h 05 min");
    expect(formatCountdown(new Date(NOW + 12 * 60_000).toISOString(), NOW)).toBe("Dans 12 min");
    expect(formatCountdown(new Date(NOW + 20_000).toISOString(), NOW)).toBe("Dans quelques instants");
  });

  it("renvoie une chaîne vide une fois l'heure passée", () => {
    expect(formatCountdown(at(-1), NOW)).toBe("");
  });
});
