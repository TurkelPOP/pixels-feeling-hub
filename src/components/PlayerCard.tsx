/* eslint-disable prettier/prettier */
import { AnimatePresence, motion } from "framer-motion";
import { Headphones, Pause, Play, RotateCcw, RotateCw } from "lucide-react";
import { useEffect, useRef } from "react";

import type { Episode } from "@/lib/podcast.functions";
import { useEpisodePlayer, usePlayer } from "@/lib/PlayerProvider";
import { SKIP_BACK_S, SKIP_FORWARD_S } from "@/lib/usePodcastPlayer";

// Always HH:MM:SS (e.g. 00:52:10, 01:34:32) so every episode reads the same way.
export function formatTime(s: number): string {
  const total = isFinite(s) && s > 0 ? Math.floor(s) : 0;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

type Props = {
  /** Épisode affiché : le lecteur commun ne le pilote que s'il est chargé, sinon le bouton lecture le lance. */
  episode: Episode | null;
  cover?: string;
  heading: string;
  subheading: string;
  /** h3 dans la liste de l'accueil, h1 sur la page d'un épisode. */
  headingLevel?: "h1" | "h3";
};

/** Le lecteur rétro : pochette CRT, titre, lecture, barre segmentée, ±secondes et vitesse. */
export function PlayerCard({ episode, cover, heading, subheading, headingLevel = "h3" }: Props) {
  const { view: player, active } = useEpisodePlayer(episode);
  const { setCardVisible } = usePlayer();
  const { playing, progress, duration, shownDuration, rate, audioError } = player;
  const Heading = headingLevel;

  // Tant que la carte du morceau en cours est à l'écran, le mini-lecteur reste caché.
  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = cardRef.current;
    if (!active || !el) {
      setCardVisible(false);
      return;
    }
    setCardVisible(true);
    const obs = new IntersectionObserver(([entry]) => setCardVisible(entry.isIntersecting), { threshold: 0.15 });
    obs.observe(el);
    return () => {
      obs.disconnect();
      setCardVisible(false);
    };
  }, [active, setCardVisible]);

  // Pointer events cover mouse, touch and pen, and allow dragging the thumb along the bar.
  const seekFromPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    player.seekTo(((e.clientX - rect.left) / rect.width) * duration);
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
      player.seekTo(progress + step);
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      player.seekTo(e.key === "Home" ? 0 : duration);
    }
  };

  // Raccourcis actifs quand le focus est dans le lecteur : k lecture/pause, j -15 s, l +30 s.
  const playerShortcuts = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target instanceof HTMLInputElement) return;
    if (e.key === "k") player.togglePlay();
    else if (e.key === "j") player.skipBy(-SKIP_BACK_S);
    else if (e.key === "l") player.skipBy(SKIP_FORWARD_S);
    else return;
    e.preventDefault();
  };

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.7 }}
      onKeyDown={playerShortcuts}
      className="glass-strong p-6 glow-magenta"
    >
      <div
        className="crt aspect-square w-full overflow-hidden rounded-card flex items-center justify-center mb-6 border-2 border-black/60"
        style={{ background: "var(--gradient-primary)" }}
      >
        <AnimatePresence mode="wait">
          {cover ? (
            <motion.img
              key={episode?.guid || "cover"}
              src={cover}
              alt={episode?.title || "Pochette du podcast"}
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
          key={episode?.guid || "loading"}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3 }}
        >
          <p className="text-[11px] hud-label text-accent mb-1">
            <span aria-hidden className={playing ? "blink-soft" : undefined}>{playing ? "▶ " : "❚❚ "}</span>
            {playing ? "En cours de lecture" : "En pause"}
          </p>
          {/* Sur la page d'un épisode le titre complet reste lisible : pas de coupure à deux lignes. */}
          <Heading className={`font-semibold text-lg sm:text-2xl ${headingLevel === "h3" ? "line-clamp-2" : "break-words"}`}>
            {heading}
          </Heading>
          <p className="text-xs text-muted-foreground mt-1">{subheading}</p>
        </motion.div>
      </AnimatePresence>
      <p role="status" className="sr-only">
        {playing && episode ? `Lecture en cours : ${episode.title}` : ""}
      </p>
      <div className="mt-5 flex items-center gap-3">
        <button
          onClick={player.togglePlay}
          aria-label={playing ? "Pause" : "Lecture"}
          disabled={!episode?.audioUrl}
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

      <div className="mt-4 flex items-center justify-center gap-2" role="group" aria-label="Contrôles de lecture">
        <button
          type="button"
          onClick={() => player.skipBy(-SKIP_BACK_S)}
          disabled={!duration}
          aria-label={`Reculer de ${SKIP_BACK_S} secondes`}
          title="Reculer de 15 s (j)"
          className="inline-flex h-10 min-w-10 items-center justify-center gap-1.5 px-3 text-[11px] hud-label text-white pixel-btn disabled:opacity-50"
        >
          <RotateCcw className="size-4" aria-hidden />
          {SKIP_BACK_S}
        </button>
        <button
          type="button"
          onClick={() => player.skipBy(SKIP_FORWARD_S)}
          disabled={!duration}
          aria-label={`Avancer de ${SKIP_FORWARD_S} secondes`}
          title="Avancer de 30 s (l)"
          className="inline-flex h-10 min-w-10 items-center justify-center gap-1.5 px-3 text-[11px] hud-label text-white pixel-btn disabled:opacity-50"
        >
          <RotateCw className="size-4" aria-hidden />
          {SKIP_FORWARD_S}
        </button>
        <button
          type="button"
          onClick={player.cycleRate}
          aria-label={`Vitesse de lecture : ${rate} fois. Changer la vitesse`}
          title="Changer la vitesse de lecture"
          className="inline-flex h-10 min-w-14 items-center justify-center px-3 text-[11px] hud-label text-white pixel-btn"
        >
          {rate}×
        </button>
      </div>

      {audioError && (
        <p role="alert" className="mt-3 text-xs text-red-300">
          {audioError}
        </p>
      )}

    </motion.div>
  );
}
