/* eslint-disable prettier/prettier */
import { createFileRoute, Link, notFound, redirect } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check, ExternalLink, Link as LinkIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Footer } from "@/components/Footer";
import { PlayerCard } from "@/components/PlayerCard";
import { episodeSlug, findEpisodeBySlug, isoDuration, linkify, truncate } from "@/lib/episodes";
import { getPodcastFeed } from "@/lib/podcast.functions";
import { PODCAST_FEED_URL, SITE_DESCRIPTION, SITE_NAME, SITE_URL, absoluteUrl } from "@/lib/site";

function formatDate(d: string): string {
  const date = new Date(d);
  if (!d || isNaN(date.getTime())) return "";
  return date.toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" });
}

export const Route = createFileRoute("/episode/$slug")({
  loader: async ({ params }) => {
    const feed = await getPodcastFeed();
    const found = findEpisodeBySlug(feed.episodes, params.slug);
    if (!found) throw notFound();
    const index = feed.episodes.indexOf(found);

    const episode = feed.episodes[index];
    const slug = episodeSlug(episode);
    // Titre modifié depuis le partage du lien : on renvoie vers l'adresse à jour.
    if (slug !== params.slug) {
      throw redirect({ to: "/episode/$slug", params: { slug }, statusCode: 301 });
    }

    // Le flux est trié du plus récent au plus ancien.
    const newer = feed.episodes[index - 1];
    const older = feed.episodes[index + 1];
    return {
      episode,
      slug,
      show: { title: feed.title, image: feed.image },
      newer: newer ? { title: newer.title, slug: episodeSlug(newer) } : null,
      older: older ? { title: older.title, slug: episodeSlug(older) } : null,
    };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const { episode, slug, show } = loaderData;
    const title = `${episode.title} | ${SITE_NAME}`;
    const description = truncate((episode.description || SITE_DESCRIPTION).replace(/\s+/g, " "), 160);
    const url = absoluteUrl(`/episode/${slug}`);
    const image = episode.image || show.image;
    const published = episode.pubDate ? new Date(episode.pubDate) : undefined;
    const datePublished = published && !isNaN(published.getTime()) ? published.toISOString() : undefined;

    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: episode.title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        // Les pochettes sont carrées : carte courte, pas la grande carte 1200x630 de l'accueil.
        { name: "twitter:card", content: "summary" },
        { name: "twitter:title", content: episode.title },
        { name: "twitter:description", content: description },
        ...(url ? [{ property: "og:url", content: url }] : []),
        ...(image
          ? [
              { property: "og:image", content: image },
              { property: "og:image:alt", content: `Pochette : ${episode.title}` },
              { name: "twitter:image", content: image },
            ]
          : []),
      ],
      links: url ? [{ rel: "canonical", href: url }] : [],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "PodcastEpisode",
            name: episode.title,
            description: episode.description || undefined,
            url,
            datePublished,
            timeRequired: isoDuration(episode.durationSec),
            inLanguage: "fr",
            image: image || undefined,
            associatedMedia: episode.audioUrl
              ? { "@type": "AudioObject", contentUrl: episode.audioUrl, encodingFormat: "audio/mpeg" }
              : undefined,
            partOfSeries: {
              "@type": "PodcastSeries",
              name: SITE_NAME,
              url: SITE_URL || undefined,
            },
          }),
        },
      ],
    };
  },
  component: EpisodePage,
});

function EpisodePage() {
  const { episode, show, newer, older } = Route.useLoaderData();
  const cover = episode.image || show.image;

  const [copied, setCopied] = useState<"ok" | "fail" | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const copyLink = async () => {
    let result: "ok" | "fail" = "ok";
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch {
      // API indisponible (origine non sécurisée) ou permission refusée.
      result = "fail";
    }
    setCopied(result);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(null), 2000);
  };

  const meta = [
    formatDate(episode.pubDate),
    episode.duration,
    episode.season ? `Saison ${episode.season}` : "",
  ].filter(Boolean);

  return (
    <main id="main" className="min-h-screen">
      <div className="mx-auto max-w-6xl px-6 pt-6 pb-16 sm:pt-10">
        <nav aria-label="Navigation de l'épisode" className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <Link to="/" className="text-3xl font-homebase text-white" style={{ letterSpacing: "0.05em" }}>
            {SITE_NAME}
          </Link>
          <Link
            to="/"
            hash="podcast"
            className="inline-flex h-10 items-center gap-2 px-3 text-[11px] hud-label text-white pixel-btn"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Tous les épisodes
          </Link>
        </nav>

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          {/* Même lecteur que sur l'accueil, commun à tout le site : la lecture continue quand on change de page. */}
          <PlayerCard
            episode={episode}
            cover={cover}
            heading={episode.title}
            subheading={meta.join(" · ")}
            headingLevel="h1"
          />

          <div className="glass flex flex-col gap-6 p-6">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={copyLink}
                className="inline-flex h-10 items-center gap-2 px-3 text-[11px] hud-label text-white pixel-btn"
              >
                {copied === "ok" ? <Check className="size-4" aria-hidden /> : <LinkIcon className="size-4" aria-hidden />}
                {copied === "ok" ? "Lien copié" : copied === "fail" ? "Copie impossible" : "Copier le lien"}
              </button>
              {episode.link && (
                <a
                  href={episode.link}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-10 items-center gap-2 px-3 text-[11px] hud-label text-white pixel-btn"
                >
                  Écouter sur Acast <ExternalLink className="size-4" aria-hidden />
                </a>
              )}
              <a
                href={PODCAST_FEED_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center gap-2 px-3 text-[11px] hud-label text-white pixel-btn"
              >
                Flux RSS
              </a>
            </div>
            <p role="status" className="sr-only">
              {copied === "ok" ? "Lien copié dans le presse-papiers" : copied === "fail" ? "Copie du lien impossible" : ""}
            </p>

            {episode.description && (
              <section aria-labelledby="episode-description" className="border-t border-border pt-5">
                <h2 id="episode-description" className="text-[11px] hud-label text-accent mb-3">
                  À propos de l'épisode
                </h2>
                {/* Un <p> par paragraphe du flux, avec un espacement unique et serré. */}
                <div className="space-y-2 break-words text-sm leading-relaxed text-white/85">
                  {episode.description.split(/\n{2,}/).map((paragraph, i) => (
                    <p key={i} className="whitespace-pre-line">
                      {linkify(paragraph).map((part, j) =>
                        part.href ? (
                          <a
                            key={j}
                            href={part.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-accent underline underline-offset-2 [overflow-wrap:anywhere] hover:text-white"
                          >
                            {part.text}
                          </a>
                        ) : (
                          part.text
                        ),
                      )}
                    </p>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>

        {(newer || older) && (
          <nav aria-label="Épisodes voisins" className="mt-6 grid gap-3 sm:grid-cols-2">
            {older ? (
              <Link
                to="/episode/$slug"
                params={{ slug: older.slug }}
                className="glass flex items-center gap-3 p-4 text-sm hover:bg-muted/20"
              >
                <ArrowLeft className="size-4 shrink-0 text-accent" aria-hidden />
                <span className="min-w-0">
                  <span className="block text-[11px] hud-label text-muted-foreground">Épisode précédent</span>
                  <span className="block truncate font-medium">{older.title}</span>
                </span>
              </Link>
            ) : (
              <span />
            )}
            {newer && (
              <Link
                to="/episode/$slug"
                params={{ slug: newer.slug }}
                className="glass flex items-center justify-end gap-3 p-4 text-right text-sm hover:bg-muted/20"
              >
                <span className="min-w-0">
                  <span className="block text-[11px] hud-label text-muted-foreground">Épisode suivant</span>
                  <span className="block truncate font-medium">{newer.title}</span>
                </span>
                <ArrowRight className="size-4 shrink-0 text-accent" aria-hidden />
              </Link>
            )}
          </nav>
        )}
      </div>
      <Footer />
    </main>
  );
}
