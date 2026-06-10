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

  // When a new episode is selected by the user, load + autoplay
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

  const selectEpisode = (ep: Episode) => {
    autoplayRef.current = true;
    if (ep.guid === current?.guid) {
      togglePlay();
      return;
    }
    setSelected(ep);
  };

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

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    audio.currentTime = ratio * duration;
  };

  const cover = current?.image || data?.image;

  return (
    <section id="podcast" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-10 flex items-end justify-between flex-wrap gap-4"
        >
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-accent mb-3">
              The Podcast
            </p>
            <h2 className="text-4xl sm:text-5xl font-bold text-gradient">
              {data?.title || "Latest Episodes"}
            </h2>
          </div>
          <a
            href={SHOW_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            All episodes <ExternalLink className="size-3.5" />
          </a>
        </motion.div>

        {/* Master player — sticky so it stays visible while scrolling the list */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="sticky top-20 z-30 rounded-3xl glass-strong p-4 sm:p-6 mb-8 glow-magenta"
        >
          <div className="flex items-center gap-4 sm:gap-6">
            {/* Cover art */}
            <div
              className="relative size-20 sm:size-28 shrink-0 rounded-2xl overflow-hidden flex items-center justify-center"
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
                    className="size-10 text-white/90"
                    strokeWidth={1.2}
                  />
                )}
              </AnimatePresence>
            </div>

            {/* Title + controls */}
            <div className="min-w-0 flex-1">
              <AnimatePresence mode="wait">
                <motion.div
                  key={current?.guid || "loading"}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3 }}
                >
                  <p className="text-[11px] uppercase tracking-[0.2em] text-accent mb-1">
                    Now playing
                  </p>
                  <h3 className="font-semibold text-base sm:text-xl line-clamp-1 sm:line-clamp-2">
                    {isLoading
                      ? "Loading episodes…"
                      : current?.title || "Select an episode"}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 hidden sm:block">
                    {formatDate(current?.pubDate || "")}
                    {current?.duration ? ` · ${current.duration}` : ""}
                  </p>
                </motion.div>
              </AnimatePresence>

              {/* Progress bar */}
              <div className="mt-3 flex items-center gap-3">
                <button
                  onClick={togglePlay}
                  aria-label={playing ? "Pause" : "Play"}
                  disabled={!current?.audioUrl}
                  className="inline-flex items-center justify-center size-11 sm:size-12 shrink-0 rounded-full bg-primary text-primary-foreground hover:scale-105 transition-transform glow-magenta disabled:opacity-50"
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
                  className="relative h-2 flex-1 rounded-full bg-muted/40 cursor-pointer group"
                  role="slider"
                  aria-label="Seek"
                  aria-valuemin={0}
                  aria-valuemax={duration}
                  aria-valuenow={progress}
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
            </div>
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

        {/* Scrollable episode list */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="rounded-3xl glass overflow-hidden"
        >
          <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
            <ListMusic className="size-4 text-accent" />
            <span className="text-sm font-medium">
              All episodes{" "}
              {episodes.length > 0 && (
                <span className="text-muted-foreground">
                  ({episodes.length})
                </span>
              )}
            </span>
          </div>

          <div className="max-h-[420px] overflow-y-auto divide-y divide-border">
            {isLoading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 px-5 py-4 animate-pulse">
                    <div className="size-9 rounded-full bg-muted/40 shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-2/3 bg-muted/40 rounded" />
                      <div className="h-3 w-1/3 bg-muted/30 rounded" />
                    </div>
                  </div>
                ))
              : episodes.map((ep, i) => {
                  const isActive = ep.guid === current?.guid;
                  const isPlayingThis = isActive && playing;
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
                        isActive
                          ? "bg-primary/10"
                          : "hover:bg-muted/20"
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
                        className={`inline-flex items-center justify-center size-9 shrink-0 rounded-full transition-all ${
                          isActive
                            ? "bg-primary text-primary-foreground glow-magenta"
                            : "bg-muted/40 text-foreground group-hover:bg-primary/30"
                        }`}
                      >
                        {isPlayingThis ? (
                          <Pause className="size-4" />
                        ) : (
                          <Play className="size-4 ml-0.5" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className={`block text-sm font-medium line-clamp-1 transition-colors ${
                            isActive ? "text-primary" : "group-hover:text-primary"
                          }`}
                        >
                          {ep.title}
                        </span>
                        <span className="block text-xs text-muted-foreground mt-0.5">
                          {formatDate(ep.pubDate)}
                          {ep.duration ? ` · ${ep.duration}` : ""}
                        </span>
                      </span>
                      {isPlayingThis && (
                        <span className="flex items-end gap-[3px] h-4 shrink-0" aria-hidden>
                          {[0, 1, 2].map((bar) => (
                            <motion.span
                              key={bar}
                              className="w-[3px] rounded-full"
                              style={{ background: "var(--magenta)" }}
                              animate={{ height: ["40%", "100%", "55%", "85%", "40%"] }}
                              transition={{
                                duration: 1,
                                repeat: Infinity,
                                delay: bar * 0.18,
                                ease: "easeInOut",
                              }}
                            />
                          ))}
                        </span>
                      )}
                    </motion.button>
                  );
                })}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
