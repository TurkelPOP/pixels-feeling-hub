import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Headphones, ExternalLink, Play, Pause } from "lucide-react";
import { useRef, useState } from "react";
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

function EpisodeCard({ ep, index }: { ep: Episode; index: number }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  const toggle = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play();
      setPlaying(true);
    }
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: Math.min(index * 0.05, 0.4) }}
      className="rounded-2xl glass p-6 glow-hover group flex flex-col"
    >
      <div className="flex items-center justify-between mb-4">
        <span
          className="text-xs font-mono px-2 py-1 rounded-md"
          style={{
            background: "oklch(0.72 0.22 330 / 0.15)",
            color: "var(--magenta)",
          }}
        >
          {formatDate(ep.pubDate) || "Episode"}
        </span>
        {ep.duration && (
          <span className="text-xs text-muted-foreground">{ep.duration}</span>
        )}
      </div>
      <h3 className="font-semibold text-lg mb-2 group-hover:text-primary transition-colors line-clamp-2">
        {ep.title}
      </h3>
      <p className="text-sm text-muted-foreground line-clamp-3 mb-4 flex-1">
        {ep.description}
      </p>
      {ep.audioUrl && (
        <div className="flex items-center gap-3 mt-auto">
          <button
            onClick={toggle}
            aria-label={playing ? "Pause episode" : "Play episode"}
            className="inline-flex items-center justify-center size-10 rounded-full bg-primary text-primary-foreground hover:scale-105 transition-transform glow-magenta"
          >
            {playing ? (
              <Pause className="size-4" />
            ) : (
              <Play className="size-4 ml-0.5" />
            )}
          </button>
          {ep.link && (
            <a
              href={ep.link}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              Open <ExternalLink className="size-3" />
            </a>
          )}
          <audio
            ref={audioRef}
            src={ep.audioUrl}
            preload="none"
            onEnded={() => setPlaying(false)}
          />
        </div>
      )}
    </motion.article>
  );
}

export function Podcast() {
  const fetchFeed = useServerFn(getPodcastFeed);
  const { data, isLoading } = useQuery({
    queryKey: ["podcast-feed"],
    queryFn: () => fetchFeed(),
    staleTime: 5 * 60_000,
  });

  const featured = data?.episodes[0];
  const rest = data?.episodes.slice(1, 10) ?? [];

  return (
    <section id="podcast" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-14 flex items-end justify-between flex-wrap gap-4"
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

        {/* Featured episode */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="rounded-3xl glass-strong p-6 sm:p-10 mb-10 glow-magenta"
        >
          <div className="grid md:grid-cols-[1fr_2fr] gap-8 items-center">
            <div
              className="aspect-square rounded-2xl relative overflow-hidden flex items-center justify-center"
              style={{ background: "var(--gradient-primary)" }}
            >
              {featured?.image || data?.image ? (
                <img
                  src={featured?.image || data?.image}
                  alt={featured?.title || "Podcast cover"}
                  className="size-full object-cover"
                />
              ) : (
                <Headphones
                  className="size-24 text-white/90"
                  strokeWidth={1.2}
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-tr from-black/40 to-transparent pointer-events-none" />
              <span className="absolute top-4 left-4 text-xs uppercase tracking-[0.2em] text-white/80">
                New Episode
              </span>
            </div>
            <div>
              <h3 className="text-2xl sm:text-3xl font-bold mb-3">
                {isLoading
                  ? "Loading latest episode…"
                  : featured?.title || "The first time a game broke your heart"}
              </h3>
              <p className="text-muted-foreground mb-6 text-sm sm:text-base leading-relaxed line-clamp-4">
                {featured?.description ||
                  "Tune in to the latest emotional deep-dive on Pixels Perspective."}
              </p>

              {featured?.audioUrl && (
                <audio
                  controls
                  preload="none"
                  src={featured.audioUrl}
                  className="w-full"
                />
              )}
            </div>
          </div>
        </motion.div>

        {/* Episodes grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-2xl glass p-6 animate-pulse space-y-3"
                >
                  <div className="h-4 w-24 bg-muted/40 rounded" />
                  <div className="h-5 w-3/4 bg-muted/40 rounded" />
                  <div className="h-3 w-full bg-muted/30 rounded" />
                  <div className="h-3 w-2/3 bg-muted/30 rounded" />
                </div>
              ))
            : rest.map((ep, i) => (
                <EpisodeCard key={ep.guid} ep={ep} index={i} />
              ))}
        </div>
      </div>
    </section>
  );
}
