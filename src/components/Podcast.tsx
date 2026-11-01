/* eslint-disable prettier/prettier */
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Link as RouterLink } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AlertCircle, Headphones, ExternalLink, Play, Pause, ListMusic, Link, CheckCircle2, Clock, FileText, Rss, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { getPodcastFeed, type Episode } from "@/lib/podcast.functions";
import { episodePath, episodeSlug } from "@/lib/episodes";
import { PlayerCard } from "@/components/PlayerCard";
import { PlayingBars } from "@/components/StickyPlayer";
import { useMediaHistory } from "@/lib/userHistory";
import { usePlayer } from "@/lib/PlayerProvider";
import { PODCAST_FEED_URL } from "@/lib/site";

const SHOW_URL = "https://shows.acast.com/644500d69f1fbe001188cbd6";
const EPISODES_PER_SEASON = 10;

function formatDate(d: string): string {
  if (!d) return "";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function Podcast() {
  const fetchFeed = useServerFn(getPodcastFeed);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["podcast-feed"],
    queryFn: () => fetchFeed(),
    staleTime: 5 * 60_000,
  });

  const episodes = useMemo(() => data?.episodes ?? [], [data?.episodes]);
  const isEmpty = !isLoading && !isError && episodes.length === 0;

  // Real seasons come from the feed (`itunes:season`). Feeds that don't tag any episode
  // fall back to chronological groups of EPISODES_PER_SEASON (oldest = S1).
  const { seasonMap, seasons } = useMemo(() => {
    const map = new Map<string, number>();
    if (episodes.some((ep) => ep.season)) {
      episodes.forEach((ep) => map.set(ep.guid, ep.season ?? 0));
    } else {
      [...episodes].reverse().forEach((ep, i) => {
        map.set(ep.guid, Math.floor(i / EPISODES_PER_SEASON) + 1);
      });
    }
    const list = [...new Set(map.values())].filter((n) => n > 0).sort((a, b) => a - b);
    return { seasonMap: map, seasons: list };
  }, [episodes]);

  const [activeSeason, setActiveSeason] = useState<number | "all">("all");
  const [query, setQuery] = useState("");
  const filteredEpisodes = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("fr");
    return episodes.filter(
      (e) =>
        (activeSeason === "all" || seasonMap.get(e.guid) === activeSeason) &&
        (!needle || `${e.title} ${e.description}`.toLocaleLowerCase("fr").includes(needle)),
    );
  }, [episodes, seasonMap, activeSeason, query]);

  const [copiedGuid, setCopiedGuid] = useState<string | null>(null);
  const [copyFailedGuid, setCopyFailedGuid] = useState<string | null>(null);

  const { getStatus } = useMediaHistory();

  const copiedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(copiedTimer.current), []);

  const copyEpisodeLink = async (ep: Episode) => {
    try {
      // Clipboard API is unavailable on insecure origins / denied permission.
      // Lien vers la page de l'épisode sur ce site.
      await navigator.clipboard.writeText(`${window.location.origin}${episodePath(ep)}`);
    } catch {
      setCopyFailedGuid(ep.guid);
      clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopyFailedGuid(null), 2000);
      return;
    }
    setCopiedGuid(ep.guid);
    clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopiedGuid(null), 2000);
  };

  // Le lecteur est commun à tout le site (PlayerProvider) : sans lecture en cours, on présente le dernier épisode.
  const { episode: loaded, play, player } = usePlayer();
  const current = loaded ?? episodes[0] ?? null;
  const cover = current?.image || data?.image;
  const { playing } = player;
  const selectEpisode = (ep: Episode) => play(ep);

  const seasonTabs: Array<{ key: number | "all"; label: string }> = [
    { key: "all", label: "Toutes" },
    ...seasons.map((n) => ({ key: n, label: `Saison ${n}` })),
  ];

  return (
    <section id="podcast" className="relative py-5 sm:py-5">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-10 flex items-end justify-between flex-wrap gap-4"
        >
          <div>
            <h2 className="text-4xl sm:text-5xl font-homebase tracking-wider text-white">
              Podcast Audio
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <a
              href={PODCAST_FEED_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Flux RSS <Rss className="size-3.5" aria-hidden />
            </a>
            <a
              href={SHOW_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Liste des épisodes <ExternalLink className="size-3.5" aria-hidden />
            </a>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-6">
          {/* LEFT: Player */}
          <PlayerCard
            episode={current}
            cover={cover}
            heading={
              isLoading
                ? "Chargement des épisodes…"
                : isError
                  ? "Podcast indisponible"
                  : isEmpty
                    ? "Aucun épisode disponible"
                    : current?.title || "Sélectionnez un épisode"
            }
            subheading={
              isError
                ? "Réessayez dans quelques instants."
                : isEmpty
                  ? "Le flux ne contient aucun épisode pour le moment."
                  : `${formatDate(current?.pubDate || "")}${current?.duration ? ` · ${current.duration}` : ""}`
            }
          />

          {/* RIGHT: Episode list */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="glass overflow-hidden flex flex-col lg:contain-size"
          >
            <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
              <ListMusic className="size-4 text-accent" />
              <span className="text-sm font-medium">
                Liste des épisodes{" "}
                {episodes.length > 0 && (
                  <span className="text-muted-foreground">({filteredEpisodes.length})</span>
                )}
              </span>
            </div>

            {episodes.length > 0 && (
              <div className="px-3 pt-3">
                <label className="relative block">
                  <span className="sr-only">Rechercher un épisode</span>
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Rechercher un épisode…"
                    className="h-10 w-full rounded-btn border-2 border-[var(--panel-edge)] bg-black/40 pl-9 pr-3 text-sm text-white placeholder:text-white/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  />
                </label>
              </div>
            )}

            {/* Season filter */}
            {seasons.length > 0 && (
              <div className="px-3 py-3 border-b border-border">
                <div className="flex flex-wrap gap-1.5">
                  {seasonTabs.map((tab) => {
                    const isActive = activeSeason === tab.key;
                    return (
                      <button
                        key={String(tab.key)}
                        onClick={() => setActiveSeason(tab.key)}
                        className="relative rounded-btn px-3 py-1.5 text-[11px] hud-label transition-colors whitespace-nowrap"
                      >
                        {isActive && (
                          <motion.span
                            layoutId="season-pill"
                            className="absolute inset-0 rounded-btn bg-magenta"
                            // Radius set inline so the layout animation doesn't stretch the corners (keep in sync with --radius-btn).
                            style={{ borderRadius: 4 }}
                            transition={{ type: "spring", stiffness: 380, damping: 32 }}
                          />
                        )}
                        <span
                          className={`relative z-10 ${
                            isActive
                              ? "text-primary-foreground"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {isActive && <span aria-hidden>▶ </span>}
                          {tab.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="max-h-[640px] overflow-y-auto divide-y divide-border lg:max-h-none lg:min-h-0 lg:flex-1">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 px-5 py-4 animate-pulse">
                    <div className="size-14 bg-muted/40 shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-2/3 bg-muted/40" />
                      <div className="h-3 w-1/3 bg-muted/30" />
                    </div>
                  </div>
                ))
              ) : isError ? (
                <div
                  className="flex flex-col items-center gap-3 px-5 py-10 text-center text-muted-foreground"
                  role="alert"
                >
                  <AlertCircle className="size-6 text-accent" />
                  <p className="text-sm">Impossible de charger les épisodes.</p>
                </div>
              ) : isEmpty ? (
                <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                  Aucun épisode disponible pour le moment.
                </div>
              ) : filteredEpisodes.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-muted-foreground" role="status">
                  Aucun épisode ne correspond à votre recherche.
                </div>
              ) : (
                filteredEpisodes.map((ep, i) => {
                  const isActive = ep.guid === current?.guid;
                  const isPlayingThis = isActive && playing;
                  const thumb = ep.image || data?.image;
                  const epHistory = getStatus(ep.guid);
                  const isCompleted = epHistory?.status === "completed";
                  const isStarted = epHistory?.status === "started";
                  return (
                    <motion.div
                      key={ep.guid}
                      initial={{ opacity: 0, x: -12 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{
                        duration: 0.35,
                        delay: Math.min(i * 0.03, 0.3),
                      }}
                      className={`w-full flex items-center gap-2 px-5 py-4 transition-all duration-300 group ${
                        isActive ? "bg-primary/10" : "hover:bg-muted/20"
                      }`}
                      style={
                        isActive
                          ? {
                              boxShadow:
                                "inset 4px 0 0 var(--magenta)",
                            }
                          : undefined
                      }
                    >
                      <button
                        type="button"
                        onClick={() => selectEpisode(ep)}
                        aria-current={isActive ? "true" : undefined}
                        className="min-w-0 flex-1 flex items-center gap-4 text-left"
                      >
                        <span
                          className="relative size-14 shrink-0 pixel-corners overflow-hidden flex items-center justify-center"
                          style={{ background: "var(--gradient-primary)" }}
                        >
                          {thumb ? (
                            <img
                              src={thumb}
                              alt=""
                              loading="lazy"
                              className="size-full object-cover"
                            />
                          ) : (
                            <Headphones className="size-6 text-white/90" />
                          )}
                          <span
                            className={`absolute inset-0 flex items-center justify-center transition-opacity ${
                              isActive
                                ? "opacity-100 bg-black/50"
                                : "opacity-0 group-hover:opacity-100 bg-black/50"
                            }`}
                          >
                            {isPlayingThis ? (
                              <PlayingBars />
                            ) : isActive ? (
                              <Pause className="size-5 text-white" />
                            ) : (
                              <Play className="size-5 ml-0.5 text-white" />
                            )}
                          </span>
                          {/* History status badge on thumbnail corner */}
                          {(isCompleted || isStarted) && (
                            <span
                              className={`absolute top-1 right-1 p-0.5 ${
                                isCompleted ? "bg-green-500/90 text-white" : "bg-amber-500/90 text-white"
                              }`}
                            >
                              {isCompleted ? <CheckCircle2 className="size-2.5" /> : <Clock className="size-2.5" />}
                            </span>
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span
                            className={`block text-sm font-medium line-clamp-2 transition-colors ${
                              isActive ? "text-magenta" : "group-hover:text-magenta"
                            }`}
                          >
                            {ep.title}
                          </span>
                          <span className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                            {formatDate(ep.pubDate)}
                            {ep.duration ? ` · ${ep.duration}` : ""}
                            {isCompleted && <span className="text-green-400 font-medium">· Écouté</span>}
                            {isStarted && !isCompleted && (
                              <span className="text-amber-400 font-medium">· En cours</span>
                            )}
                          </span>
                        </span>
                      </button>
                      <RouterLink
                        to="/episode/$slug"
                        params={{ slug: episodeSlug(ep) }}
                        aria-label={`Voir la page de l'épisode : ${ep.title}`}
                        title="Page de l'épisode"
                        className="shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 max-sm:opacity-100 transition-opacity p-2 hover:bg-white/10"
                      >
                        <FileText className="size-3.5 text-muted-foreground" />
                      </RouterLink>
                      <button
                        type="button"
                        onClick={() => copyEpisodeLink(ep)}
                        aria-label={`Copier le lien de l'épisode : ${ep.title}`}
                        className="shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 max-sm:opacity-100 transition-opacity p-2 hover:bg-white/10"
                      >
                        {copiedGuid === ep.guid ? (
                          <span className="text-[10px] text-accent font-medium">✓</span>
                        ) : copyFailedGuid === ep.guid ? (
                          <span className="text-[10px] text-red-300 font-medium" role="alert">
                            Échec
                          </span>
                        ) : (
                          <Link className="size-3.5 text-muted-foreground" />
                        )}
                      </button>
                    </motion.div>
                  );
                })
              )}
            </div>
          </motion.div>
        </div>
      </div>

    </section>
  );
}
