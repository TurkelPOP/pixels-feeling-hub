/* eslint-disable prettier/prettier */
import { createFileRoute } from "@tanstack/react-router";
import { Hero } from "@/components/Hero";
import { Podcast } from "@/components/Podcast";
import { YouTubeSection } from "@/components/YouTubeSection";
import { TwitchSection } from "@/components/TwitchSection";
import { Footer } from "@/components/Footer";
import { ScrollProgress } from "@/components/ScrollProgress";
import { SITE_DESCRIPTION, SITE_TITLE } from "@/lib/site";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: SITE_TITLE },
      { name: "description", content: SITE_DESCRIPTION },
    ],
  }),
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
      <ScrollProgress />
      <Hero />
      <Podcast />
      <YouTubeSection />
      <TwitchSection />
      <Footer />
    </main>
  );
}
