/* eslint-disable prettier/prettier */
import { createFileRoute } from "@tanstack/react-router";
import { Hero } from "@/components/Hero";
import { Podcast } from "@/components/Podcast";
import { YouTubeSection } from "@/components/YouTubeSection";
import { Footer } from "@/components/Footer";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pixels Perspective — The emotions behind the controller" },
      {
        name: "description",
        content:
          "A gaming podcast about the real feelings we experience with a controller in our hands. Listen and watch on YouTube.",
      },
      {
        property: "og:title",
        content: "Pixels Perspective — Feeling the games",
      },
      {
        property: "og:description",
        content:
          "A passionate gaming podcast exploring the emotions behind every pixel.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="min-h-screen">
      <Hero />
      <Podcast />
      <YouTubeSection />
      <Footer />
    </main>
  );
}
