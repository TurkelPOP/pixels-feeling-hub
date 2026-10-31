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

// Always HH:MM:SS (e.g. 00:52:10, 01:34:32) so every episode reads the same way.
function formatTime(s: number): string {
  const total = isFinite(s) && s > 0 ? Math.floor(s) : 0;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
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
  const [copyFailedGuid, setCopyFailedGuid] = useState<string | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);

  const { getStatus, markStarted, markCompleted } = useMediaHistory();

  const copiedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(copiedTimer.current), []);

  const copyEpisodeLink = async (ep: Episode) => {
    try {
      // Clipboard API is unavailable on insecure origins / denied permission.
      await navigator.clipboard.writeText(ep.link || SHOW_URL);
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

  const current = selected ?? episodes[0] ?? null;

  const startPlayback = (audio: HTMLAudioElement) => {
    setAudioError(null);
    audio
      .play()
      .then(() => setPlaying(true))
      .catch((error: unknown) => {
        setPlaying(false);
        // AbortError: play() was interrupted by a newer load/pause, not a failure.
        if (error instanceof DOMException && error.name === "AbortError") return;
        setAudioError("Lecture impossible. Réessayez ou écoutez l'épisode sur Acast.");
      });
  };

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
      setAudioError(null);
      if (autoplayRef.current) startPlayback(audio);
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
      startPlayback(audio);
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

  // Pointer events cover mouse, touch and pen, and allow dragging the thumb along the bar.
  const seekFromPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    seekTo(((e.clientX - rect.left) / rect.width) * duration);
  };

  const startSeek = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    seekFromPointer(e);
  };

  const dragSeek = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) seekFromPointer(e);
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
  // The audio is only fetched on play (preload="none"): until its metadata arrives,
  // show the length announced by the feed so the timer reads m:ss from the start.
  const shownDuration = duration || current?.durationSec || 0;

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
          <a
            href={SHOW_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
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
            className="glass-strong p-6 glow-magenta"
          >
            <div
              className="crt aspect-square w-full overflow-hidden rounded-card flex items-center justify-center mb-6 border-2 border-black/60"
              style={{ background: "var(--gradient-primary)" }}
            >
              <AnimatePresence mode="wait">
                {cover ? (
                  <motion.img
                    key={current?.guid || "cover"}
                    src={cover}
                    alt={current?.title || "Pochette du podcast"}
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
                <p className="text-[11px] hud-label text-accent mb-1">
                  <span aria-hidden className="blink-soft">▶ </span>En cours de lecture
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
            <p role="status" className="sr-only">
              {playing && current ? `Lecture en cours : ${current.title}` : ""}
            </p>
            <div className="mt-5 flex items-center gap-3">
              <button
                onClick={togglePlay}
                aria-label={playing ? "Pause" : "Lecture"}
                disabled={!current?.audioUrl}
                className="inline-flex items-center justify-center size-12 shrink-0 pixel-btn bg-magenta text-primary-foreground disabled:opacity-50"
              >
                {playing ? <Pause className="size-5" /> : <Play className="size-5 ml-0.5" />}
              </button>
              <span className="text-[11px] font-mono text-muted-foreground min-w-10 shrink-0 text-right">
                {formatTime(progress)}
              </span>
              <div
                onPointerDown={startSeek}
                onPointerMove={dragSeek}
                onKeyDown={seekWithKeyboard}
                tabIndex={duration ? 0 : -1}
                className="relative h-3 flex-1 touch-none bg-black/50 border-2 border-[var(--panel-edge)] cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
                role="slider"
                aria-label="Position de lecture"
                aria-valuemin={0}
                aria-valuemax={Math.round(duration)}
                aria-valuenow={Math.round(progress)}
                aria-valuetext={`${formatTime(progress)} sur ${formatTime(shownDuration)}`}
              >
                <div
                  className="absolute inset-y-0 left-0 segmented"
                  style={{
                    width: duration ? `${(progress / duration) * 100}%` : "0%",
                    background: "var(--gradient-accent)",
                  }}
                />
              </div>
              <span className="text-[11px] font-mono text-muted-foreground min-w-10 shrink-0">
                {formatTime(shownDuration)}
              </span>
            </div>

            {audioError && (
              <p role="alert" className="mt-3 text-xs text-red-300">
                {audioError}
              </p>
            )}

            <audio
              ref={audioRef}
              preload="none"
              onError={(e) => {
                // An emptied src (no playable episode) also fires `error`: ignore it.
                if (!e.currentTarget.getAttribute("src")) return;
                setPlaying(false);
                setAudioError("Impossible de charger l'audio de cet épisode.");
              }}
              onTimeUpdate={(e) => setProgress(e.currentTarget.currentTime)}
              onLoadedMetadata={(e) => {
                const d = e.currentTarget.duration;
                setDuration(Number.isFinite(d) ? d : 0);
              }}
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

      <StickyPlayer
        visible={playing && playerOutOfView && !!current}
        title={current?.title || ""}
        playing={playing}
        progress={progress}
        duration={shownDuration}
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
