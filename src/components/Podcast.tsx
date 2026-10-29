/* eslint-disable prettier/prettier */
import { AnimatePresence, motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertCircle, Headphones, ExternalLink, Play, Pause, ListMusic, Link, CheckCircle2, Clock } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { getPodcastFeed, type Episode } from "@/lib/podcast.functions";
import { StickyPlayer, PlayingBars } from "@/components/StickyPlayer";
import { useMediaHistory } from "@/lib/userHistory";

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

function formatTime(s: number): string {
  if (!isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
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

  // Mock seasons: assign by chronological order (oldest = S1).
  const { seasonMap, seasonCount } = useMemo(() => {
    const map = new Map<string, number>();
    const asc = [...episodes].slice().reverse();
    asc.forEach((ep, i) => {
      map.set(ep.guid, Math.floor(i / EPISODES_PER_SEASON) + 1);
    });
    const count = asc.length ? Math.ceil(asc.length / EPISODES_PER_SEASON) : 0;
    return { seasonMap: map, seasonCount: count };
  }, [episodes]);

  const [activeSeason, setActiveSeason] = useState<number | "all">("all");
  const filteredEpisodes = useMemo(() => {
    if (activeSeason === "all") return episodes;
    return episodes.filter((e) => seasonMap.get(e.guid) === activeSeason);
  }, [episodes, seasonMap, activeSeason]);

  const [selected, setSelected] = useState<Episode | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const autoplayRef = useRef(false);
  const playerRef = useRef<HTMLDivElement | null>(null);
  const [playerOutOfView, setPlayerOutOfView] = useState(false);
  const [copiedGuid, setCopiedGuid] = useState<string | null>(null);

  const { getStatus, markStarted, markCompleted } = useMediaHistory();

  const copiedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(copiedTimer.current), []);

  const copyEpisodeLink = async (ep: Episode) => {
    try {
      // Clipboard API is unavailable on insecure origins / denied permission.
      await navigator.clipboard.writeText(ep.link || SHOW_URL);
    } catch {
      return;
    }
    setCopiedGuid(ep.guid);
    clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopiedGuid(null), 2000);
  };

  const current = selected ?? episodes[0] ?? null;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!current?.audioUrl) {
      // Don't keep the previous episode loaded behind an unplayable selection.
      audio.pause();
      audio.removeAttribute("src");
      setProgress(0);
      setDuration(0);
      return;
    }
    if (audio.src !== current.audioUrl) {
      audio.src = current.audioUrl;
      setProgress(0);
      setDuration(0);
      if (autoplayRef.current) {
        audio
          .play()
          .then(() => setPlaying(true))
          .catch(() => setPlaying(false));
      }
    }
  }, [current?.audioUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePlay = () => {
      if (current?.guid) {
        markStarted(current.guid, "podcast");
      }
    };

    const handleEnded = () => {
      if (current?.guid) {
        markCompleted(current.guid, "podcast");
      }
    };

    const handleTimeUpdate = () => {
      if (audio.duration > 0 && current?.guid) {
        const pct = (audio.currentTime / audio.duration) * 100;
        if (pct >= 90) {
          markCompleted(current.guid, "podcast");
        }
      }
    };

    audio.addEventListener("play", handlePlay);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("timeupdate", handleTimeUpdate);

    return () => {
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
    };
  }, [current?.guid, markStarted, markCompleted]);

  useEffect(() => {
    const el = playerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => setPlayerOutOfView(!entry.isIntersecting), {
      threshold: 0.15,
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio || !current?.audioUrl) return;
    if (!audio.src) audio.src = current.audioUrl;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio
        .play()
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false));
    }
  };

  const selectEpisode = (ep: Episode) => {
    autoplayRef.current = true;
    if (ep.guid === current?.guid) {
      togglePlay();
      return;
    }
    setSelected(ep);
  };

  const seekTo = (seconds: number) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    audio.currentTime = Math.min(Math.max(seconds, 0), duration);
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    seekTo(((e.clientX - rect.left) / rect.width) * duration);
  };

  const seekWithKeyboard = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = { ArrowLeft: -10, ArrowDown: -10, ArrowRight: 10, ArrowUp: 10 }[e.key];
    if (step !== undefined) {
      e.preventDefault();
      seekTo(progress + step);
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      seekTo(e.key === "Home" ? 0 : duration);
    }
  };

  const cover = current?.image || data?.image;

  const seasonTabs: Array<{ key: number | "all"; label: string }> = [
    { key: "all", label: "Toutes les saisons" },
    ...Array.from({ length: seasonCount }, (_, i) => ({
      key: i + 1,
      label: `Saison ${i + 1}`,
    })),
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
          <a
            href={SHOW_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-sm text-white-muted-foreground hover:text-foreground transition-colors"
          >
            Liste des épisodes <ExternalLink className="size-3.5" />
          </a>
        </motion.div>

        <div className="grid lg:grid-cols-[1.1fr_1fr] gap-6">
          {/* LEFT: Player */}
          <motion.div
            ref={playerRef}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="rounded-3xl glass-strong p-6 glow-magenta lg:sticky lg:top-24 self-start"
          >
            <div
              className="relative aspect-square w-full rounded-2xl overflow-hidden flex items-center justify-center mb-6"
              style={{ background: "var(--gradient-primary)" }}
            >
              <AnimatePresence mode="wait">
                {cover ? (
                  <motion.img
                    key={current?.guid || "cover"}
                    src={cover}
                    alt={current?.title || "Podcast cover"}
                    initial={{ opacity: 0, scale: 1.06 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.35 }}
                    className="absolute inset-0 size-full object-cover"
                  />
                ) : (
                  <Headphones className="size-16 text-white/90" strokeWidth={1.2} />
                )}
              </AnimatePresence>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={current?.guid || "loading"}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
              >
                <p className="text-[11px] uppercase tracking-[0.2em] text-accent mb-1">
                  En cours de lecture
                </p>
                <h3 className="font-semibold text-lg sm:text-2xl line-clamp-2">
                  {isLoading
                    ? "Chargement des épisodes…"
                    : isError
                      ? "Podcast indisponible"
                      : isEmpty
                        ? "Aucun épisode disponible"
                        : current?.title || "Sélectionnez un épisode"}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {isError
                    ? "Réessayez dans quelques instants."
                    : isEmpty
                      ? "Le flux ne contient aucun épisode pour le moment."
                      : `${formatDate(current?.pubDate || "")}${current?.duration ? ` · ${current.duration}` : ""}`}
                </p>
              </motion.div>
            </AnimatePresence>
            <div className="mt-5 flex items-center gap-3">
              <button
                onClick={togglePlay}
                aria-label={playing ? "Pause" : "Play"}
                disabled={!current?.audioUrl}
                className="inline-flex items-center justify-center size-12 shrink-0 rounded-full bg-primary text-primary-foreground hover:scale-105 transition-transform glow-magenta disabled:opacity-50"
              >
                {playing ? <Pause className="size-5" /> : <Play className="size-5 ml-0.5" />}
              </button>
              <span className="text-[11px] font-mono text-muted-foreground w-10 text-right">
                {formatTime(progress)}
              </span>
              <div
                onClick={seek}
                onKeyDown={seekWithKeyboard}
                tabIndex={duration ? 0 : -1}
                className="relative h-2 flex-1 rounded-full bg-muted/40 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
                role="slider"
                aria-label="Position de lecture"
                aria-valuemin={0}
                aria-valuemax={Math.round(duration)}
                aria-valuenow={Math.round(progress)}
                aria-valuetext={`${formatTime(progress)} sur ${formatTime(duration)}`}
              >
                <div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    width: duration ? `${(progress / duration) * 100}%` : "0%",
                    background: "var(--gradient-accent)",
                  }}
                />
              </div>
              <span className="text-[11px] font-mono text-muted-foreground w-10">
                {formatTime(duration)}
              </span>
            </div>

            <audio
              ref={audioRef}
              preload="none"
              onTimeUpdate={(e) => setProgress(e.currentTarget.currentTime)}
              onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
              onEnded={() => setPlaying(false)}
              onPause={() => setPlaying(false)}
              onPlay={() => setPlaying(true)}
            />
          </motion.div>

          {/* RIGHT: Episode list */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="rounded-3xl glass overflow-hidden flex flex-col"
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

            {/* Season filter */}
            {seasonCount > 0 && (
              <div className="px-3 py-3 border-b border-border overflow-x-auto scrollbar-hide">
                <div className="flex gap-1.5 w-max">
                  {seasonTabs.map((tab) => {
                    const isActive = activeSeason === tab.key;
                    return (
                      <button
                        key={String(tab.key)}
                        onClick={() => setActiveSeason(tab.key)}
                        className="relative px-3.5 py-1.5 text-xs font-medium rounded-full transition-colors whitespace-nowrap"
                      >
                        {isActive && (
                          <motion.span
                            layoutId="season-pill"
                            className="absolute inset-0 rounded-full bg-primary"
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
                          {tab.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="max-h-[640px] overflow-y-auto divide-y divide-border">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 px-5 py-4 animate-pulse">
                    <div className="size-14 rounded-lg bg-muted/40 shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-2/3 bg-muted/40 rounded" />
                      <div className="h-3 w-1/3 bg-muted/30 rounded" />
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
                                "inset 3px 0 0 var(--magenta), 0 0 24px -8px oklch(0.72 0.22 330 / 0.5)",
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
                          className="relative size-14 shrink-0 rounded-lg overflow-hidden flex items-center justify-center"
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
                              className={`absolute top-1 right-1 rounded-full p-0.5 ${
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
                              isActive ? "text-primary" : "group-hover:text-primary"
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
                      <button
                        type="button"
                        onClick={() => copyEpisodeLink(ep)}
                        aria-label={`Copier le lien de l'épisode : ${ep.title}`}
                        className="shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 max-sm:opacity-100 transition-opacity p-2 rounded-full hover:bg-white/10"
                      >
                        {copiedGuid === ep.guid ? (
                          <span className="text-[10px] text-accent font-medium">✓</span>
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

      <StickyPlayer
        visible={playing && playerOutOfView && !!current}
        title={current?.title || ""}
        playing={playing}
        progress={progress}
        duration={duration}
        cover={cover}
        onToggle={togglePlay}
        onClose={() => {
          const a = audioRef.current;
          if (a) a.pause();
          setPlaying(false);
        }}
      />
    </section>
  );
}
