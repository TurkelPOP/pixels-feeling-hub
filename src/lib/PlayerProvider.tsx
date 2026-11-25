/* eslint-disable prettier/prettier */
import { createContext, useContext, useRef, useState, type ReactNode } from "react";

import { StickyPlayer } from "@/components/StickyPlayer";
import type { Episode } from "./podcast.functions";
import { SITE_NAME } from "./site";
import { usePodcastPlayer, type PodcastPlayer } from "./usePodcastPlayer";

/** Ce que les cartes lecteur ont besoin de l'état de lecture (sans l'élément <audio>, que seul le provider rend). */
export type PlayerView = Omit<PodcastPlayer, "audioProps">;

type PlayerContextValue = {
  /** Épisode chargé dans l'élément audio, null tant que rien n'a été lancé. */
  episode: Episode | null;
  player: PodcastPlayer;
  /** Charge et lance cet épisode ; bascule lecture/pause s'il est déjà chargé. */
  play: (episode: Episode) => void;
  /** Une carte lecteur visible à l'écran remplace le mini-lecteur. */
  setCardVisible: (visible: boolean) => void;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);

function usePlayerContext(): PlayerContextValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayerContext doit être utilisé dans <PlayerProvider>");
  return ctx;
}

/**
 * Un seul lecteur pour tout le site, monté à la racine : la lecture continue quand on passe de
 * l'accueil à une page épisode, et le mini-lecteur reste disponible partout.
 */
export function PlayerProvider({ children }: { children: ReactNode }) {
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [cardVisible, setCardVisible] = useState(false);
  const autoplayRef = useRef(false);
  const player = usePodcastPlayer({ episode, cover: episode?.image, showTitle: SITE_NAME, autoplayRef });

  const play = (ep: Episode) => {
    autoplayRef.current = true;
    if (ep.guid === episode?.guid) {
      player.togglePlay();
      return;
    }
    setEpisode(ep);
  };

  const { audioProps, ...state } = player;

  return (
    <PlayerContext.Provider value={{ episode, player, play, setCardVisible }}>
      {children}
      <audio {...audioProps} />
      <StickyPlayer
        visible={state.playing && !cardVisible && !!episode}
        title={episode?.title || ""}
        playing={state.playing}
        progress={state.progress}
        duration={state.shownDuration}
        cover={episode?.image}
        onToggle={state.togglePlay}
        onClose={state.pause}
      />
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  return usePlayerContext();
}

const noop = () => {};

/**
 * État du lecteur vu depuis la page d'un épisode donné. Si cet épisode est celui qui est chargé,
 * c'est le vrai lecteur ; sinon une vue au repos dont le bouton lecture le charge et le lance
 * (sans toucher à l'épisode en cours tant qu'on n'a pas appuyé).
 */
export function useEpisodePlayer(episode: Episode | null): { view: PlayerView; active: boolean } {
  const { episode: loaded, player, play } = usePlayerContext();
  const active = !!episode && loaded?.guid === episode.guid;

  if (active) {
    const { audioProps: _audioProps, ...view } = player;
    return { view, active };
  }

  return {
    active,
    view: {
      playing: false,
      progress: 0,
      duration: 0,
      shownDuration: episode?.durationSec ?? 0,
      rate: player.rate,
      audioError: null,
      togglePlay: () => {
        if (episode) play(episode);
      },
      pause: noop,
      // La vitesse est commune à tous les épisodes : on peut la régler avant de lancer la lecture.
      cycleRate: player.cycleRate,
      skipBy: noop,
      seekTo: noop,
    },
  };
}
