/* eslint-disable prettier/prettier */
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Play, ListVideo, AlertCircle } from "lucide-react";
import { getPlaylists, getLatestVideo } from "@/lib/youtube.functions";

const CHANNEL_ID = "UC7eDkZaMYbiURgdv042M2pg";

export function YouTubeSection() {
  const fetchPlaylists = useServerFn(getPlaylists);
  const fetchLatest = useServerFn(getLatestVideo);
  const { data, isLoading } = useQuery({
    queryKey: ["youtube-playlists"],
    queryFn: () => fetchPlaylists(),
  });
  const { data: latest } = useQuery({
    queryKey: ["youtube-latest"],
    queryFn: () => fetchLatest(),
  });

  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string>("");
  const [userPicked, setUserPicked] = useState(false);

  const playerError = !embedUrl && latest?.error ? latest.error : null;

  useEffect(() => {
    if (userPicked || !latest?.videoId) return;
    setEmbedUrl(
      `https://www.youtube.com/embed/${latest.videoId}?autoplay=0&rel=0`,
    );
    setActiveId(latest.videoId);
  }, [latest, userPicked]);

  return (
    <section id="youtube" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <h2 className="text-4xl sm:text-5xl font-bold text-gradient">
            Vidéos YouTube
          </h2>
        </motion.div>

        <div className="grid lg:grid-cols-[1.4fr_1fr] gap-6">
          {/* LEFT: Player */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="lg:sticky lg:top-24 self-start aspect-video w-full rounded-3xl overflow-hidden glow-cyan border border-border glass-strong"
          >
            {embedUrl ? (
              <iframe
                key={embedUrl}
                title="Latest YouTube video"
                src={embedUrl}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="size-full"
              />
            ) : (
              <div className="size-full flex items-center justify-center p-8 text-center">
                {playerError ? (
                  <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <AlertCircle className="size-8 text-accent" />
                    <p className="text-sm max-w-xs">{playerError}</p>
                  </div>
                ) : (
                  <div className="size-10 rounded-full border-2 border-accent border-t-transparent animate-spin" />
                )}
              </div>
            )}
          </motion.div>

          {/* RIGHT: Playlist list */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="rounded-3xl glass overflow-hidden flex flex-col"
          >
            <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
              <ListVideo className="size-4 text-accent" />
              <span className="text-sm font-medium">Playlists</span>
              {data?.fallback && (
                <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <AlertCircle className="size-3.5" /> Fallback
                </span>
              )}
            </div>

            <div className="max-h-[640px] overflow-y-auto divide-y divide-border">
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-4 px-5 py-4 animate-pulse"
                    >
                      <div className="w-28 aspect-video rounded-lg bg-muted/40 shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-2/3 bg-muted/40 rounded" />
                        <div className="h-3 w-1/3 bg-muted/30 rounded" />
                      </div>
                    </div>
                  ))
                : data?.playlists.map((pl, i) => {
                    const isFallback = pl.id.startsWith("fallback");
                    const isActive = pl.id === activeId;
                    const handleClick = (e: React.MouseEvent) => {
                      if (isFallback) return;
                      e.preventDefault();
                      setUserPicked(true);
                      setEmbedUrl(
                        `https://www.youtube.com/embed/videoseries?list=${pl.id}`,
                      );
                      setActiveId(pl.id);
                    };
                    return (
                      <motion.a
                        key={pl.id}
                        href={
                          isFallback
                            ? `https://www.youtube.com/channel/${CHANNEL_ID}/playlists`
                            : `https://www.youtube.com/playlist?list=${pl.id}`
                        }
                        onClick={handleClick}
                        target={isFallback ? "_blank" : undefined}
                        rel={isFallback ? "noreferrer" : undefined}
                        initial={{ opacity: 0, x: -12 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{
                          duration: 0.35,
                          delay: Math.min(i * 0.04, 0.3),
                        }}
                        className={`w-full text-left flex items-center gap-4 px-5 py-4 transition-all duration-300 group cursor-pointer ${
                          isActive ? "bg-accent/10" : "hover:bg-muted/20"
                        }`}
                        style={
                          isActive
                            ? {
                                boxShadow:
                                  "inset 3px 0 0 var(--accent), 0 0 24px -8px oklch(0.78 0.18 200 / 0.5)",
                              }
                            : undefined
                        }
                      >
                        <span
                          className="relative w-28 aspect-video shrink-0 rounded-lg overflow-hidden flex items-center justify-center"
                          style={{
                            background: pl.thumbnail
                              ? undefined
                              : "var(--gradient-accent)",
                          }}
                        >
                          {pl.thumbnail ? (
                            <img
                              src={pl.thumbnail}
                              alt=""
                              loading="lazy"
                              className="size-full object-cover transition-transform group-hover:scale-105"
                            />
                          ) : (
                            <Play
                              className="size-7 text-white/90"
                              strokeWidth={1.5}
                            />
                          )}
                          <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[10px] bg-black/70 backdrop-blur text-white">
                            {pl.itemCount}
                          </span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span
                            className={`block text-sm font-medium line-clamp-2 transition-colors ${
                              isActive ? "text-accent" : "group-hover:text-accent"
                            }`}
                          >
                            {pl.title}
                          </span>
                          <span className="block text-xs text-muted-foreground mt-1 line-clamp-1">
                            {pl.description || "Curated collection."}
                          </span>
                        </span>
                      </motion.a>
                    );
                  })}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
