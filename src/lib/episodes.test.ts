import { describe, expect, it } from "vitest";

import { episodeSlug, findEpisodeBySlug, isoDuration, linkify, slugify, truncate } from "./episodes";
import type { Episode } from "./podcast.functions";

const ep = (guid: string, title: string): Episode => ({
  guid,
  title,
  description: "",
  pubDate: "",
  duration: "",
  audioUrl: "",
  image: "",
  link: "",
});

describe("episodes", () => {
  it("simplifie les titres en slug", () => {
    expect(slugify("CARTE MÉMOIRE: Lysiane")).toBe("carte-memoire-lysiane");
    expect(slugify("Pokémon & Pokopia !")).toBe("pokemon-et-pokopia");
    expect(slugify("???")).toBe("episode");
  });

  it("borne la longueur du slug sans finir par un tiret", () => {
    const slug = slugify("mot ".repeat(40));
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug.endsWith("-")).toBe(false);
  });

  it("produit un slug stable et distinct par guid", () => {
    const a = episodeSlug(ep("6aad70a0f0112d8f457e5d4b", "Même titre"));
    expect(a).toBe(episodeSlug(ep("6aad70a0f0112d8f457e5d4b", "Même titre")));
    expect(a).not.toBe(episodeSlug(ep("autre-guid", "Même titre")));
    expect(a).toMatch(/^meme-titre-[0-9a-f]{8}$/);
  });

  it("retrouve l'épisode même si le titre du slug est périmé", () => {
    const episodes = [ep("a", "Premier"), ep("https://x.test/b.mp3", "Second")];
    const slug = episodeSlug(episodes[1]);
    expect(findEpisodeBySlug(episodes, slug)).toBe(episodes[1]);
    expect(findEpisodeBySlug(episodes, slug.replace(/^.*-/, "ancien-titre-"))).toBe(episodes[1]);
  });

  it("refuse un slug sans empreinte valide", () => {
    expect(findEpisodeBySlug([ep("a", "Premier")], "premier")).toBeUndefined();
    expect(findEpisodeBySlug([ep("a", "Premier")], "premier-zzzzzzzz")).toBeUndefined();
  });

  it("formate la durée ISO 8601", () => {
    expect(isoDuration(5672)).toBe("PT1H34M32S");
    expect(isoDuration(3600)).toBe("PT1H");
    expect(isoDuration(45)).toBe("PT45S");
    expect(isoDuration(undefined)).toBeUndefined();
  });

  it("tronque proprement", () => {
    expect(truncate("court", 20)).toBe("court");
    const out = truncate("un deux trois quatre cinq six sept huit", 20);
    expect(out.length).toBeLessThanOrEqual(20);
    expect(out.endsWith("…")).toBe(true);
  });
});

describe("linkify", () => {
  it("transforme les adresses http(s) en liens", () => {
    expect(linkify("Voir https://linktr.ee/pixelsperspective maintenant")).toEqual([
      { text: "Voir " },
      { text: "https://linktr.ee/pixelsperspective", href: "https://linktr.ee/pixelsperspective" },
      { text: " maintenant" },
    ]);
  });

  it("complète les adresses www. en https", () => {
    expect(linkify("En live : www.twitch.tv/turkelpop")).toEqual([
      { text: "En live : " },
      { text: "www.twitch.tv/turkelpop", href: "https://www.twitch.tv/turkelpop" },
    ]);
  });

  it("laisse la ponctuation finale hors du lien", () => {
    expect(linkify("(voir https://exemple.fr/a.)")).toEqual([
      { text: "(voir " },
      { text: "https://exemple.fr/a", href: "https://exemple.fr/a" },
      { text: ".)" },
    ]);
  });

  it("ne touche pas au texte sans adresse", () => {
    expect(linkify("Rien à voir ici @+++")).toEqual([{ text: "Rien à voir ici @+++" }]);
  });
});
