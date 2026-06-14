/* eslint-disable prettier/prettier */
import { AnimatePresence, motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Headphones, ExternalLink, Play, Pause, ListMusic } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getPodcastFeed, type Episode } from "@/lib/podcast.functions";

const SHOW_URL = "https://shows.acast.com/644500d69f1fbe001188cbd6";

function formatDate(d: string): string {
  if (!d) return "";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
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
  const { data, isLoading } = useQuery({
    queryKey: ["podcast-feed"],
    queryFn: () => fetchFeed(),
    staleTime: 5 * 60_000,
  });

  const episodes = data?.episodes ?? [];
  const [selected, setSelected] = useState<Episode | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const autoplayRef = useRef(false);

  const current = selected ?? episodes[0] ?? null;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !current?.audioUrl) return;
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

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    audio.currentTime = ratio * duration;
  };

  const cover = current?.image || data?.image;

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
            <h2 className="text-4xl sm:text-5xl font-normal text-white">
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
                  <Headphones
                    className="size-16 text-white/90"
                    strokeWidth={1.2}
                  />
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
                    ? "Loading episodes…"
                    : current?.title || "Select an episode"}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatDate(current?.pubDate || "")}
                  {current?.duration ? ` · ${current.duration}` : ""}
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
                {playing ? (
                  <Pause className="size-5" />
                ) : (
                  <Play className="size-5 ml-0.5" />
                )}
              </button>
              <span className="text-[11px] font-mono text-muted-foreground w-10 text-right">
                {formatTime(progress)}
              </span>
              <div
                onClick={seek}
                className="relative h-2 flex-1 rounded-full bg-muted/40 cursor-pointer"
                role="slider"
                aria-label="Seek"
                aria-valuemin={0}
                aria-valuemax={Number(duration)}
                aria-valuenow={Number(progress)}
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
                  <span className="text-muted-foreground">
                    ({episodes.length})
                  </span>
                )}
              </span>
            </div>

            <div className="max-h-[640px] overflow-y-auto divide-y divide-border">
              {isLoading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4 px-5 py-4 animate-pulse">
                      <div className="size-14 rounded-lg bg-muted/40 shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-2/3 bg-muted/40 rounded" />
                        <div className="h-3 w-1/3 bg-muted/30 rounded" />
                      </div>
                    </div>
                  ))
                : episodes.map((ep, i) => {
                    const isActive = ep.guid === current?.guid;
                    const isPlayingThis = isActive && playing;
                    const thumb = ep.image || data?.image;
                    return (
                      <motion.button
                        key={ep.guid}
                        onClick={() => selectEpisode(ep)}
                        initial={{ opacity: 0, x: -12 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{
                          duration: 0.35,
                          delay: Math.min(i * 0.03, 0.3),
                        }}
                        className={`w-full text-left flex items-center gap-4 px-5 py-4 transition-all duration-300 group ${
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
                              <Pause className="size-5 text-white" />
                            ) : (
                              <Play className="size-5 ml-0.5 text-white" />
                            )}
                          </span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span
                            className={`block text-sm font-medium line-clamp-2 transition-colors ${
                              isActive ? "text-primary" : "group-hover:text-primary"
                            }`}
                          >
                            {ep.title}
                          </span>
                          <span className="block text-xs text-muted-foreground mt-1">
                            {formatDate(ep.pubDate)}
                            {ep.duration ? ` · ${ep.duration}` : ""}
                          </span>
                        </span>
                      </motion.button>
                    );
                  })}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
