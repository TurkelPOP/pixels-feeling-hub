import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Play, ListVideo, AlertCircle } from "lucide-react";
import { getPlaylists } from "@/lib/youtube.functions";

const CHANNEL_ID = "UC7eDkZaMYbiURgdv042M2pg";
const UPLOADS_PLAYLIST_ID = CHANNEL_ID.replace("UC", "UU");
const DEFAULT_EMBED = `https://www.youtube.com/embed/videoseries?list=${UPLOADS_PLAYLIST_ID}`;

export function YouTubeSection() {
  const fetchPlaylists = useServerFn(getPlaylists);
  const { data, isLoading } = useQuery({
    queryKey: ["youtube-playlists"],
    queryFn: () => fetchPlaylists(),
  });

  const [embedUrl, setEmbedUrl] = useState<string>(DEFAULT_EMBED);

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
          <p className="text-xs uppercase tracking-[0.3em] text-accent mb-3">
            Watch on YouTube
          </p>
          <h2 className="text-4xl sm:text-5xl font-bold text-gradient">
            Video Stories
          </h2>
        </motion.div>

        {/* Featured video */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="aspect-video w-full rounded-3xl overflow-hidden glow-cyan border border-border mb-16 glass-strong"
        >
          <iframe
            key={embedUrl}
            title="YouTube playlist"
            src={embedUrl}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="size-full"
          />
        </motion.div>

        {/* Playlists */}
        <div className="mb-6 flex items-center gap-3">
          <ListVideo className="size-5 text-accent" />
          <h3 className="text-xl font-semibold">Playlists</h3>
          {data?.fallback && (
            <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <AlertCircle className="size-3.5" /> Showing fallback collections
            </span>
          )}
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-2xl glass overflow-hidden animate-pulse"
                >
                  <div className="aspect-video bg-muted/40" />
                  <div className="p-5 space-y-3">
                    <div className="h-4 bg-muted/40 rounded w-3/4" />
                    <div className="h-3 bg-muted/30 rounded w-full" />
                    <div className="h-3 bg-muted/30 rounded w-1/2" />
                  </div>
                </div>
              ))
            : data?.playlists.map((pl, i) => {
                const isFallback = pl.id.startsWith("fallback");
                const handleClick = (e: React.MouseEvent) => {
                  if (isFallback) return;
                  e.preventDefault();
                  setEmbedUrl(
                    `https://www.youtube.com/embed/videoseries?list=${pl.id}`,
                  );
                  document
                    .getElementById("youtube")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
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
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: i * 0.05 }}
                    className="group rounded-2xl glass overflow-hidden glow-hover cursor-pointer"
                  >
                    <div
                      className="aspect-video relative overflow-hidden flex items-center justify-center"
                      style={{
                        background: pl.thumbnail
                          ? undefined
                          : "var(--gradient-accent)",
                      }}
                    >
                      {pl.thumbnail ? (
                        <img
                          src={pl.thumbnail}
                          alt={pl.title}
                          loading="lazy"
                          className="size-full object-cover transition-transform group-hover:scale-105"
                        />
                      ) : (
                        <Play
                          className="size-12 text-white/90"
                          strokeWidth={1.5}
                        />
                      )}
                      <div className="absolute bottom-2 right-2 px-2 py-1 rounded-md text-xs bg-black/70 backdrop-blur text-white">
                        {pl.itemCount} videos
                      </div>
                    </div>
                    <div className="p-5">
                      <h4 className="font-semibold mb-1 group-hover:text-primary transition-colors line-clamp-1">
                        {pl.title}
                      </h4>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {pl.description || "Curated collection of videos."}
                      </p>
                    </div>
                  </motion.a>
                );
              })}
        </div>
      </div>
    </section>
  );
}
