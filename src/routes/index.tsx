/* eslint-disable prettier/prettier */
import { createFileRoute } from "@tanstack/react-router";
import { Hero } from "@/components/Hero";
import { Podcast } from "@/components/Podcast";
import { YouTubeSection } from "@/components/YouTubeSection";
import { TwitchSection } from "@/components/TwitchSection";
import { Footer } from "@/components/Footer";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, absoluteUrl } from "@/lib/site";

export const Route = createFileRoute("/")({
  head: () => {
    // Canonical et og:url par page : le root les partagerait sinon avec les pages épisode.
    const url = absoluteUrl("/");
    return {
      meta: [
        { title: SITE_TITLE },
        { name: "description", content: SITE_DESCRIPTION },
        ...(url ? [{ property: "og:url", content: url }] : []),
        // Dimensions de /og-image.jpg (image par défaut du root) : propres à l'accueil, les pages épisode ont leur pochette.
        { property: "og:image:width", content: "1200" },
        { property: "og:image:height", content: "630" },
        { property: "og:image:alt", content: `${SITE_NAME} : le podcast qui joue avec vos émotions` },
      ],
      links: url ? [{ rel: "canonical", href: url }] : [],
    };
  },
  component: Index,
});

function Index() {
  return (
    <main id="main" className="min-h-screen">
      <a
        href="#podcast"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[70] focus:px-4 focus:py-2 pixel-btn bg-magenta text-[11px] hud-label text-primary-foreground"
      >
        Aller au contenu
      </a>
      <Hero />
      <Podcast />
      <YouTubeSection />
      <TwitchSection />
      <Footer />
    </main>
  );
}
