/* eslint-disable prettier/prettier */
import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Play, ListVideo, AlertCircle, ExternalLink, CheckCircle2, Clock } from "lucide-react";
import { getPlaylists } from "@/lib/youtube.functions";
import { useMediaHistory } from "@/lib/userHistory";

export function YouTubeSection() {
  const fetchPlaylists = useServerFn(getPlaylists);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["youtube-playlists"],
    queryFn: () => fetchPlaylists(),
    staleTime: 5 * 60_000,
  });
  const isEmpty = !isLoading && !isError && !data?.playlists.length;

  const [pickedId, setPickedId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  // Until the user picks a video, show the latest one (first in the list).
  const activeId = pickedId ?? data?.playlists[0]?.id ?? "";

  const { getStatus, markStarted } = useMediaHistory();

  const activeVideo = data?.playlists?.find((p) => p.id === activeId);
  const thumbnail =
    activeVideo?.thumbnail ||
    (activeId ? `https://i.ytimg.com/vi/${activeId}/maxresdefault.jpg` : null);

  const handleSelectVideo = (id: string) => {
    setPickedId(id);
    setPlaying(true); // Auto-play when selecting from list
    markStarted(id, "youtube");
  };

  const handlePlay = () => {
    setPlaying(true);
    if (activeId) markStarted(activeId, "youtube");
  };

  const embedSrc = activeId
    ? `https://www.youtube-nocookie.com/embed/${activeId}?autoplay=1&rel=0&modestbranding=1`
    : null;

  return (
    <section id="youtube" className="relative py-5 sm:py-5">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <h2 className="text-4xl sm:text-5xl font-homebase tracking-wider text-white">
            Vidéos YouTube
          </h2>
        </motion.div>

        <div className="grid lg:grid-cols-[1.4fr_1fr] gap-6">
          {/* LEFT: Native Embedded YouTube Player */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="lg:sticky lg:top-24 self-start flex flex-col gap-3"
          >
            <div className="aspect-video w-full overflow-hidden glow-cyan border-4 border-black/70 outline-2 outline-[var(--panel-edge)] relative bg-black">
              {isLoading ? (
                <div className="size-full flex items-center justify-center">
                  <div className="size-10 border-4 border-accent border-t-transparent animate-spin" />
                </div>
              ) : isError ? (
                <div className="size-full flex flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground" role="alert">
                  <AlertCircle className="size-8 text-accent" />
                  <p className="text-sm">Impossible de charger les vidéos YouTube.</p>
                </div>
              ) : isEmpty ? (
                <div className="size-full flex items-center justify-center p-8 text-center text-sm text-muted-foreground">
                  Aucune vidéo disponible pour le moment.
                </div>
              ) : playing && embedSrc ? (
                <iframe
                  key={embedSrc}
                  title={activeVideo?.title || "Pixels Perspective Video"}
                  src={embedSrc}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                  className="size-full border-0"
                />
              ) : (
                /* Lite embed: thumbnail + play button */
                <button
                  type="button"
                  onClick={handlePlay}
                  className="crt size-full group cursor-pointer"
                  aria-label={`Lire : ${activeVideo?.title || "Vidéo YouTube"}`}
                >
                  {thumbnail && (
                    <img
                      src={thumbnail}
                      alt={activeVideo?.title || ""}
                      className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                      onError={(e) => {
                        // fallback to hqdefault if maxresdefault fails
                        const t = e.currentTarget;
                        if (t.src.includes("maxresdefault")) {
                          t.src = `https://i.ytimg.com/vi/${activeId}/hqdefault.jpg`;
                        }
                      }}
                    />
                  )}
                  {/* Dark overlay */}
                  <span className="absolute inset-0 bg-black/30 group-hover:bg-black/20 transition-colors duration-300" />
                  {/* Play button */}
                  <span className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                    <span className="relative z-10 flex items-center justify-center size-16 pixel-btn bg-red-600 group-hover:bg-red-500">
                      <Play className="size-7 text-white fill-white ml-1" />
                    </span>
                  </span>
                </button>
              )}
            </div>

            {/* Direct YouTube link bar */}
            {activeId && (
              <div className="flex items-center justify-between px-2 text-xs text-muted-foreground">
                <span className="truncate pr-2 font-medium text-white/80">
                  {activeVideo?.title || "Vidéo YouTube"}
                </span>
                <a
                  href={`https://www.youtube.com/watch?v=${activeId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 shrink-0 text-accent hover:underline font-medium"
                >
                  Regarder sur YouTube <ExternalLink className="size-3" />
                </a>
              </div>
            )}
          </motion.div>


          {/* RIGHT: Playlist list */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="glass overflow-hidden flex flex-col"
          >
            <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
              <ListVideo className="size-4 text-accent" />
              <span className="text-sm font-medium">
                Playlist Pixels Perspective
              </span>
              {data?.fallback && (
                <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <AlertCircle className="size-3.5" /> Mode secours
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
                      <div className="w-28 aspect-video bg-muted/40 shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-2/3 bg-muted/40" />
                        <div className="h-3 w-1/3 bg-muted/30" />
                      </div>
                    </div>
                  ))
                : isError ? (
                    <div className="flex flex-col items-center gap-3 px-5 py-10 text-center text-muted-foreground" role="alert">
                      <AlertCircle className="size-6 text-accent" />
                      <p className="text-sm">Impossible de charger les vidéos YouTube.</p>
                    </div>
                  ) : isEmpty ? (
                    <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                      Aucune vidéo disponible pour le moment.
                    </div>
                  ) : data?.playlists.map((pl, i) => {
                    const isActive = pl.id === activeId;
                    const plHistory = getStatus(pl.id);
                    const isCompleted = plHistory?.status === "completed";
                    const isStarted = plHistory?.status === "started";
                    const handleClick = (e: React.MouseEvent) => {
                      // Keep the real link for middle-click / new tab, play inline otherwise.
                      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                      e.preventDefault();
                      handleSelectVideo(pl.id);
                    };
                    return (
                      <motion.a
                        key={pl.id}
                        href={`https://www.youtube.com/watch?v=${pl.id}`}
                        onClick={handleClick}
                        aria-current={isActive ? "true" : undefined}
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
                                  "inset 4px 0 0 var(--accent)",
                              }
                            : undefined
                        }
                      >
                        <span
                          className="relative w-28 aspect-video shrink-0 pixel-corners overflow-hidden flex items-center justify-center"
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
                          <span className="absolute bottom-1 right-1 px-1.5 py-0.5 text-[10px] bg-black/80 text-white font-mono">
                            {pl.itemCount}
                          </span>
                          {/* History badge on thumbnail */}
                          {(isCompleted || isStarted) && (
                            <span
                              className={`absolute top-1 left-1 p-0.5 ${
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
                              isActive
                                ? "text-accent"
                                : "group-hover:text-accent"
                            }`}
                          >
                            {pl.title}
                          </span>
                          <span className="text-xs text-muted-foreground mt-1 line-clamp-1 flex items-center gap-1.5">
                            {pl.description || "Pixels Perspective"}
                            {isCompleted && <span className="text-green-400 font-medium">· Vu</span>}
                            {isStarted && !isCompleted && (
                              <span className="text-amber-400 font-medium">· En cours</span>
                            )}
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
