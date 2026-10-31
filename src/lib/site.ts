export const SITE_NAME = "Pixels Perspective";
export const SITE_TITLE = "Pixels Perspective — Le podcast qui joue avec vos émotions";
export const SITE_DESCRIPTION =
  "Un podcast jeu vidéo sur les émotions ressenties manette en main. À écouter en audio, à regarder sur YouTube et en live sur Twitch.";

// Public origin (ex. https://pixelsperspective.fr), sans slash final. Non secret : l'URL du site.
// Sans elle, les balises qui exigent une URL absolue (og:image, og:url, canonical) sont omises.
export const SITE_URL = ((import.meta.env.VITE_SITE_URL as string | undefined) ?? "").replace(
  /\/+$/,
  "",
);

export function absoluteUrl(path: string): string | undefined {
  return SITE_URL ? `${SITE_URL}${path}` : undefined;
}

export const SITE_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "PodcastSeries",
  name: SITE_NAME,
  description: SITE_DESCRIPTION,
  inLanguage: "fr",
  url: SITE_URL || undefined,
  sameAs: [
    "https://www.twitch.tv/turkelpop",
    "https://www.youtube.com/playlist?list=PLf7hoWB9RRm6L2_2u7hVvoDcfFvsO9mwg",
    "https://www.instagram.com/_pixelsperspective_/",
    "https://www.facebook.com/pixelsperspectivepodcast/",
    "https://www.threads.com/@_pixelsperspective_",
    "https://www.tiktok.com/@pixels_perspective",
    "https://shows.acast.com/644500d69f1fbe001188cbd6",
  ],
};
