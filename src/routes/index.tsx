/* eslint-disable prettier/prettier */
import { createFileRoute } from "@tanstack/react-router";
import { Hero } from "@/components/Hero";
import { Podcast } from "@/components/Podcast";
import { YouTubeSection } from "@/components/YouTubeSection";
import { TwitchSection } from "@/components/TwitchSection";
import { Footer } from "@/components/Footer";
import { ScrollProgress } from "@/components/ScrollProgress";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pixels Perspective — Le podcast qui joue avec vos émotions" },
      {
        name: "description",
        content:
          "Un podcast jeu vidéo sur les émotions ressenties manette en main. À écouter en audio, à regarder sur YouTube et en live sur Twitch.",
      },
      {
        property: "og:title",
        content: "Pixels Perspective — Le podcast qui joue avec vos émotions",
      },
      {
        property: "og:description",
        content:
          "Un podcast sur le jeu vidéo axé sur les émotions et le ressenti des joueurs manette en main.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="min-h-screen">
      <ScrollProgress />
      <Hero />
      <Podcast />
      <YouTubeSection />
      <TwitchSection />
      <Footer />
    </main>
  );
}
