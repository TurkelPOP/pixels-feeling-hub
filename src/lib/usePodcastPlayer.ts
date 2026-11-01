import { useEffect, useRef, useState, type MutableRefObject } from "react";

import type { Episode } from "./podcast.functions";
import {
  clearPosition,
  getResumePosition,
  loadRate,
  nextRate,
  saveRate,
  savePosition,
} from "./podcastPlayback";
import { useMediaHistory } from "./userHistory";

export const SKIP_BACK_S = 15;
export const SKIP_FORWARD_S = 30;
const POSITION_SAVE_EVERY_S = 5;

type Options = {
  episode: Episode | null;
  /** Pochette et titre du podcast pour l'écran verrouillé (Media Session). */
  cover?: string;
  showTitle?: string;
  /** Mis à true par l'appelant pour lancer la lecture dès que l'épisode change. */
  autoplayRef?: MutableRefObject<boolean>;
};

/**
 * Lecture d'un épisode : état, reprise de position, vitesse, historique et Media Session.
 * Partagé par le lecteur de l'accueil et par les pages épisode, qui affichent le même `PlayerCard`.
 */
export function usePodcastPlayer({ episode, cover, showTitle, autoplayRef }: Options) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [rate, setRate] = useState(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastSavedAtRef = useRef(0);
  const resumedGuidRef = useRef<string | null>(null);
  const { markStarted, markCompleted } = useMediaHistory();

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
    if (!episode?.audioUrl) {
      // Don't keep the previous episode loaded behind an unplayable selection.
      audio.pause();
      audio.removeAttribute("src");
      setProgress(0);
      setDuration(0);
      return;
    }
    if (audio.src !== episode.audioUrl) {
      audio.src = episode.audioUrl;
      lastSavedAtRef.current = 0;
      setProgress(0);
      setDuration(0);
      setAudioError(null);
      if (autoplayRef?.current) startPlayback(audio);
    }
  }, [episode?.audioUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePlay = () => {
      if (episode?.guid) markStarted(episode.guid, "podcast");
    };

    const handleEnded = () => {
      if (episode?.guid) {
        markCompleted(episode.guid, "podcast");
        clearPosition(episode.guid);
      }
    };

    const handlePause = () => {
      if (episode?.guid && !audio.ended) savePosition(episode.guid, audio.currentTime);
    };

    const handleTimeUpdate = () => {
      if (episode?.guid && Math.abs(audio.currentTime - lastSavedAtRef.current) >= POSITION_SAVE_EVERY_S) {
        lastSavedAtRef.current = audio.currentTime;
        savePosition(episode.guid, audio.currentTime);
      }
      if (audio.duration > 0 && episode?.guid) {
        const pct = (audio.currentTime / audio.duration) * 100;
        if (pct >= 90) markCompleted(episode.guid, "podcast");
      }
    };

    audio.addEventListener("play", handlePlay);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("timeupdate", handleTimeUpdate);

    return () => {
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
    };
  }, [episode?.guid, markStarted, markCompleted]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio || !episode?.audioUrl) return;
    if (!audio.src) audio.src = episode.audioUrl;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      startPlayback(audio);
    }
  };

  const pause = () => {
    audioRef.current?.pause();
    setPlaying(false);
  };

  // Vitesse lue après l'hydratation (localStorage n'existe pas côté serveur).
  useEffect(() => setRate(loadRate()), []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    // defaultPlaybackRate survit au changement de `src`, contrairement à playbackRate.
    audio.defaultPlaybackRate = rate;
    audio.playbackRate = rate;
  }, [rate]);

  const cycleRate = () => {
    const next = nextRate(rate);
    setRate(next);
    saveRate(next);
  };

  const skipBy = (delta: number) => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    audio.currentTime = Math.min(Math.max(audio.currentTime + delta, 0), audio.duration);
  };

  const seekTo = (seconds: number) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    audio.currentTime = Math.min(Math.max(seconds, 0), duration);
  };

  // Media Session : titre, pochette et boutons sur l'écran verrouillé, les écouteurs et les touches média.
  useEffect(() => {
    if (!("mediaSession" in navigator) || !episode) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: episode.title,
      artist: "Pixels Perspective",
      album: showTitle || "Pixels Perspective",
      artwork: cover ? [{ src: cover }] : [],
    });
  }, [episode, cover, showTitle]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const session = navigator.mediaSession;
    session.playbackState = playing ? "playing" : "paused";
    const handlers: Array<[MediaSessionAction, MediaSessionActionHandler]> = [
      ["play", () => togglePlay()],
      ["pause", () => togglePlay()],
      ["seekbackward", (d) => skipBy(-(d.seekOffset ?? SKIP_BACK_S))],
      ["seekforward", (d) => skipBy(d.seekOffset ?? SKIP_FORWARD_S)],
      ["seekto", (d) => seekTo(d.seekTime ?? 0)],
    ];
    for (const [action, handler] of handlers) {
      try {
        session.setActionHandler(action, handler);
      } catch {
        // Action non gérée par ce navigateur.
      }
    }
    return () => {
      for (const [action] of handlers) {
        try {
          session.setActionHandler(action, null);
        } catch {
          // idem
        }
      }
    };
  });

  useEffect(() => {
    if (!("mediaSession" in navigator) || !duration || !isFinite(duration)) return;
    try {
      navigator.mediaSession.setPositionState({
        duration,
        position: Math.min(progress, duration),
        playbackRate: rate,
      });
    } catch {
      // Valeurs refusées par le navigateur : l'affichage système restera approximatif.
    }
  }, [progress, duration, rate]);

  // Props de l'élément <audio> que le composant d'affichage rend.
  const audioProps = {
    ref: audioRef,
    preload: "none" as const,
    onError: (e: React.SyntheticEvent<HTMLAudioElement>) => {
      // An emptied src (no playable episode) also fires `error`: ignore it.
      if (!e.currentTarget.getAttribute("src")) return;
      setPlaying(false);
      setAudioError("Impossible de charger l'audio de cet épisode.");
    },
    onTimeUpdate: (e: React.SyntheticEvent<HTMLAudioElement>) => setProgress(e.currentTarget.currentTime),
    onLoadedMetadata: (e: React.SyntheticEvent<HTMLAudioElement>) => {
      const audio = e.currentTarget;
      const d = audio.duration;
      setDuration(Number.isFinite(d) ? d : 0);
      // Une seule reprise par épisode chargé, pour ne pas écraser un déplacement manuel.
      if (episode?.guid && resumedGuidRef.current !== episode.guid) {
        resumedGuidRef.current = episode.guid;
        const at = getResumePosition(episode.guid, Number.isFinite(d) ? d : 0);
        if (at > 0) {
          audio.currentTime = at;
          lastSavedAtRef.current = at;
        }
      }
    },
    onEnded: () => setPlaying(false),
    onPause: () => setPlaying(false),
    onPlay: () => setPlaying(true),
  };

  return {
    audioProps,
    playing,
    progress,
    duration,
    // The audio is only fetched on play (preload="none"): until its metadata arrives,
    // show the length announced by the feed so the timer reads from the start.
    shownDuration: duration || episode?.durationSec || 0,
    rate,
    audioError,
    togglePlay,
    pause,
    cycleRate,
    skipBy,
    seekTo,
  };
}

export type PodcastPlayer = ReturnType<typeof usePodcastPlayer>;
