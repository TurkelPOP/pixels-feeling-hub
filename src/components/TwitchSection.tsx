/* eslint-disable prettier/prettier */
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertCircle, Play, Tv, ExternalLink, Radio, Calendar, Clock, Sparkles, CheckCircle2 } from "lucide-react";
import { getTwitchData, type TwitchVideo } from "@/lib/twitch.functions";
import { useTwitchAuth } from "@/lib/useTwitchAuth";
import { useMediaHistory } from "@/lib/userHistory";

function TwitchIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.429h-3.429l-3 3v-3H6.857V1.714h13.714z" />
    </svg>
  );
}

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

export function TwitchSection() {
  const { user } = useTwitchAuth();
  const { getStatus, markStarted } = useMediaHistory();
  const fetchTwitch = useServerFn(getTwitchData);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["twitch-data"],
    queryFn: () => fetchTwitch(),
    staleTime: 2 * 60_000,
  });

  const videos = useMemo(() => data?.videos ?? [], [data?.videos]);
  const isLive = data?.stream?.isLive ?? false;
  const isEmpty = !isLoading && !isError && !isLive && videos.length === 0;
  const channelName = data?.channelName || "turkelpop";
  const channelUrl = data?.channelUrl || `https://www.twitch.tv/${channelName}`;

  const [pickedVideoId, setPickedVideoId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playLive, setPlayLive] = useState(false);
  // Twitch embeds require the embedding hostname; only known after hydration.
  const [hostname, setHostname] = useState("localhost");

  useEffect(() => {
    setHostname(window.location.hostname || "localhost");
  }, []);

  const activeVideo: TwitchVideo | undefined =
    videos.find((v) => v.id === pickedVideoId) ?? videos[0];

  const handleSelectVideo = (video: TwitchVideo) => {
    setPickedVideoId(video.id);
    setPlayLive(false);
    setIsPlaying(false);
  };

  const handleToggleLive = () => {
    setPlayLive(true);
    setIsPlaying(true);
  };

  const playerParams: Record<string, string> | null = playLive
    ? { channel: channelName }
    : activeVideo?.id
      ? { video: activeVideo.id }
      : null;
  const embedSrc = playerParams
    ? `https://player.twitch.tv/?${new URLSearchParams({
        ...playerParams,
        parent: hostname,
        autoplay: "true",
        muted: "false",
      })}`
    : null;

  return (
    <section id="twitch" className="relative py-5 sm:py-5">
      <div className="mx-auto max-w-6xl px-6">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-10 flex items-end justify-between flex-wrap gap-4"
        >
          <div>
            <div className="flex items-center gap-2.5 mb-2 flex-wrap">
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1 text-[11px] hud-label text-white pixel-corners"
                style={{ background: "var(--twitch)" }}
              >
                <TwitchIcon className="size-3.5" />
                Twitch
              </span>
              {isLive && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 text-[11px] hud-label bg-red-600 text-white pixel-corners blink-soft">
                  <span className="size-2 bg-white" />
                  En Direct
                </span>
              )}
              {user && (
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1 text-xs font-semibold bg-purple-950/80 border-2 border-purple-400/50 text-purple-200">
                  <Sparkles className="size-3.5 text-yellow-300 fill-yellow-300" />
                  Ravi de vous revoir, <strong className="text-white">{user.displayName}</strong> !
                </span>
              )}
            </div>
            <h2 className="text-4xl sm:text-5xl font-homebase tracking-wider text-white">
              Diffusions Twitch
            </h2>
          </div>

          {data?.fallback && (
            <p className="text-xs text-muted-foreground">Mode secours : données de démonstration.</p>
          )}

          <a
            href={channelUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors"
          >
            Rejoindre sur Twitch <ExternalLink className="size-3.5 text-accent" />
          </a>
        </motion.div>

        <div className="grid lg:grid-cols-[1.3fr_1fr] gap-6">
          {/* LEFT: Main Spotlight / Player */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="flex flex-col gap-3"
          >
            {/* Live Banner if currently live */}
            {isLive && !playLive && (
              <div className="p-4 glass border-red-500/60! flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="relative flex size-3">
                    <span className="relative inline-flex size-3 bg-red-500 blink-soft"></span>
                  </span>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-red-400">
                      Live en cours
                    </p>
                    <p className="text-sm font-semibold text-white line-clamp-1">
                      {data?.stream?.title || "Stream en direct sur Twitch !"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleToggleLive}
                  className="shrink-0 px-3.5 py-1.5 text-[11px] hud-label pixel-btn bg-red-600 text-white hover:bg-red-500"
                >
                  Regarder le Live
                </button>
              </div>
            )}

            {/* Video Player Card */}
            <div
              className="aspect-video w-full overflow-hidden rounded-card border-4 border-black/70 outline-2 -outline-offset-2 outline-[var(--panel-edge)] relative bg-black"
              style={{
                boxShadow: "4px 4px 0 var(--twitch)",
              }}
            >
              {isLoading ? (
                <div className="size-full flex items-center justify-center">
                  <div
                    className="size-10 border-4 border-t-transparent animate-spin"
                    style={{ borderColor: "var(--twitch)" }}
                  />
                </div>
              ) : isError ? (
                <div className="size-full flex flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground" role="alert">
                  <AlertCircle className="size-8 text-accent" />
                  <p className="text-sm">Impossible de charger Twitch.</p>
                </div>
              ) : isEmpty ? (
                <div className="size-full flex items-center justify-center p-8 text-center text-sm text-muted-foreground">
                  Aucune diffusion disponible pour le moment.
                </div>
              ) : isPlaying && embedSrc ? (
                <iframe
                  key={embedSrc}
                  title={activeVideo?.title || "Twitch Player"}
                  src={embedSrc}
                  allow="autoplay; fullscreen; picture-in-picture"
                  allowFullScreen
                  className="size-full border-0"
                />
              ) : (
                /* Lite embed: Thumbnail + Play trigger */
                <button
                  type="button"
                  onClick={() => {
                    setIsPlaying(true);
                    if (activeVideo?.id) markStarted(activeVideo.id, "twitch");
                  }}
                  className="crt size-full group cursor-pointer text-left"
                  aria-label={`Lire la diffusion : ${activeVideo?.title || "Diffusion Twitch"}`}
                >
                  {activeVideo?.thumbnailUrl && (
                    <img
                      src={activeVideo.thumbnailUrl}
                      alt={activeVideo.title}
                      className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                      onError={(e) => {
                        e.currentTarget.src =
                          "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=800&q=80";
                      }}
                    />
                  )}

                  {/* Gradient Overlay */}
                  <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/20 group-hover:from-black/75 transition-colors" />

                  {/* Top Badges */}
                  <span className="absolute top-4 left-4 flex items-center gap-2">
                    <span
                      className="inline-flex items-center gap-1.5 px-3 py-1 text-[11px] hud-label text-white pixel-corners"
                      style={{ background: "var(--twitch)" }}
                    >
                      <TwitchIcon className="size-3" />
                      {playLive ? "EN DIRECT" : "Dernière diffusion"}
                    </span>
                    {activeVideo?.gameName && (
                      <span className="px-3 py-1 text-xs font-medium bg-black/70 text-white/90 border-2 border-white/15">
                        {activeVideo.gameName}
                      </span>
                    )}
                  </span>

                  {/* Play Button */}
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span
                      className="flex items-center justify-center size-16 pixel-btn"
                      style={{
                        background: "var(--twitch)",
                      }}
                    >
                      <Play className="size-7 text-white fill-white ml-1" />
                    </span>
                  </span>

                  {/* Bottom Video Meta */}
                  <span className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-4">
                    <span className="min-w-0 flex-1">
                      <span className="block text-base sm:text-lg font-bold text-white line-clamp-1">
                        {activeVideo?.title}
                      </span>
                      <span className="flex items-center gap-3 text-xs text-white/70 mt-1 font-medium">
                        {activeVideo?.createdAt && (
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="size-3 text-accent" />
                            {formatDate(activeVideo.createdAt)}
                          </span>
                        )}
                        {activeVideo?.duration && (
                          <span className="inline-flex items-center gap-1">
                            <Clock className="size-3 text-accent" />
                            {activeVideo.duration}
                          </span>
                        )}
                      </span>
                    </span>
                  </span>
                </button>
              )}
            </div>

            {/* Direct Channel Link Bar */}
            {activeVideo && (
              <div className="flex items-center justify-between px-2 text-xs text-muted-foreground">
                <span className="truncate pr-2 font-medium text-white/80">
                  {activeVideo.title}
                </span>
                <a
                  href={activeVideo.url || channelUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 shrink-0 hover:underline font-semibold"
                  style={{ color: "var(--twitch)" }}
                >
                  Ouvrir sur Twitch <ExternalLink className="size-3" />
                </a>
              </div>
            )}
          </motion.div>

          {/* RIGHT: Previous Diffusions List */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="glass overflow-hidden flex flex-col lg:contain-size"
          >
            {/* List Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Radio className="size-4" style={{ color: "var(--twitch)" }} />
                <span className="text-sm font-medium text-white">
                  Diffusions précédentes
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                {videos.length} rediffusions
              </span>
            </div>

            {/* Scrollable Items */}
            <div className="max-h-[640px] overflow-y-auto divide-y divide-border lg:max-h-none lg:min-h-0 lg:flex-1">
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
                      <p className="text-sm">Impossible de charger Twitch.</p>
                    </div>
                  ) : isEmpty ? (
                    <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                      Aucune diffusion disponible pour le moment.
                    </div>
                  ) : videos.map((video, i) => {
                    const isActive = video.id === activeVideo?.id && !playLive;
                    const videoHistory = getStatus(video.id);
                    const isCompleted = videoHistory?.status === "completed";
                    const isStarted = videoHistory?.status === "started";
                    return (
                      <motion.button
                        key={video.id}
                        onClick={() => handleSelectVideo(video)}
                        initial={{ opacity: 0, x: -12 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{
                          duration: 0.35,
                          delay: Math.min(i * 0.04, 0.3),
                        }}
                        className={`w-full text-left flex items-center gap-4 px-5 py-4 transition-all duration-300 group cursor-pointer ${
                          isActive
                            ? "bg-purple-900/20"
                            : "hover:bg-muted/20"
                        }`}
                        style={
                          isActive
                            ? {
                                boxShadow:
                                  "inset 4px 0 0 var(--twitch)",
                              }
                            : undefined
                        }
                      >
                        {/* Thumbnail */}
                        <span className="relative w-28 aspect-video shrink-0 pixel-corners overflow-hidden flex items-center justify-center bg-black/50">
                          {video.thumbnailUrl ? (
                            <img
                              src={video.thumbnailUrl}
                              alt=""
                              loading="lazy"
                              className="size-full object-cover transition-transform group-hover:scale-105"
                              onError={(e) => {
                                e.currentTarget.src =
                                  "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=800&q=80";
                              }}
                            />
                          ) : (
                            <Tv
                              className="size-7 text-white/90"
                              strokeWidth={1.5}
                            />
                          )}

                          {(isCompleted || isStarted) && (
                            <span className={`absolute top-1 left-1 p-0.5 ${
                              isCompleted ? "bg-green-500/90 text-white" : "bg-amber-500/90 text-white"
                            }`}>
                              {isCompleted ? <CheckCircle2 className="size-2.5" /> : <Clock className="size-2.5" />}
                            </span>
                          )}

                          {/* Hover Play Indicator */}
                          <span
                            className={`absolute inset-0 flex items-center justify-center transition-opacity ${
                              isActive
                                ? "opacity-100 bg-black/40"
                                : "opacity-0 group-hover:opacity-100 bg-black/40"
                            }`}
                          >
                            <Play className="size-5 text-white fill-white" />
                          </span>

                          {/* Duration Badge */}
                          {video.duration && (
                            <span className="absolute bottom-1 right-1 px-1.5 py-0.5 text-[10px] bg-black/80 text-white font-mono">
                              {video.duration}
                            </span>
                          )}
                        </span>

                        {/* Video Info */}
                        <span className="min-w-0 flex-1">
                          <span
                            className={`block text-sm font-semibold line-clamp-2 transition-colors ${
                              isActive
                                ? "text-purple-300"
                                : "group-hover:text-purple-300 text-white"
                            }`}
                          >
                            {video.title}
                          </span>
                          <span className="flex items-center gap-2 text-xs text-muted-foreground mt-1 line-clamp-1">
                            {video.createdAt && (
                              <span>{formatDate(video.createdAt)}</span>
                            )}
                            {video.gameName && (
                              <>
                                <span>•</span>
                                <span className="text-accent/90 truncate">
                                  {video.gameName}
                                </span>
                              </>
                            )}
                            {isCompleted && <span className="text-green-400 font-medium">· Vu</span>}
                            {isStarted && !isCompleted && <span className="text-amber-400 font-medium">· En cours</span>}
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
