import { useEffect } from "react";

import { SYNC_DIRTY_EVENT, applyPlaybackFromSync, readPlaybackForSync } from "@/lib/podcastPlayback";
import { syncExchange } from "@/lib/sync.functions";
import { setSyncStatus } from "@/lib/syncStatus";
import { useTwitchAuth } from "@/lib/useTwitchAuth";
import { applyHistoryFromSync, readHistoryForSync } from "@/lib/userHistory";

/** Au plus un échange toutes les 20 s pendant une écoute : les positions changent toutes les quelques secondes. */
const PUSH_DELAY_MS = 20_000;

/**
 * Moteur de synchronisation entre appareils, actif seulement pour un utilisateur connecté avec Twitch.
 * Il échange l'état local contre l'état fusionné du serveur : à l'ouverture, à chaque changement
 * (au plus toutes les 20 s), et quand l'onglet est masqué ou réaffiché. Il ne rend rien.
 */
export function SyncEngine() {
  const { user } = useTwitchAuth();
  const userId = user?.id;

  useEffect(() => {
    if (!userId) {
      setSyncStatus("off");
      return;
    }

    let cancelled = false;
    // Session absente ou synchro désactivée côté serveur : inutile de réessayer avant une nouvelle connexion.
    let stopped = false;
    let inFlight = false;
    let rerun = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const run = async () => {
      if (stopped) return;
      if (inFlight) {
        rerun = true;
        return;
      }
      clearTimeout(timer);
      timer = undefined;
      inFlight = true;
      setSyncStatus("syncing");
      try {
        const { positions, rate } = readPlaybackForSync();
        const result = await syncExchange({
          data: { positions, history: readHistoryForSync(userId), ...(rate ? { rate } : {}) },
        });
        if (cancelled) return;
        if (result.status === "ok") {
          applyPlaybackFromSync(result.data);
          applyHistoryFromSync(userId, result.data.history);
          setSyncStatus("synced");
        } else if (result.status === "unauthenticated") {
          stopped = true;
          setSyncStatus("reconnect");
        } else if (result.status === "disabled") {
          stopped = true;
          setSyncStatus("off");
        } else {
          setSyncStatus("error");
        }
      } catch (error) {
        console.error("[sync] exchange failed", error);
        if (!cancelled) setSyncStatus("error");
      } finally {
        inFlight = false;
        if (rerun && !cancelled) {
          rerun = false;
          schedule();
        }
      }
    };

    const schedule = () => {
      if (timer || stopped) return;
      timer = setTimeout(() => {
        timer = undefined;
        void run();
      }, PUSH_DELAY_MS);
    };

    // Un onglet masqué peut être fermé : on envoie tout de suite. Réaffiché, on récupère ce qui a bougé ailleurs.
    const onVisibility = () => void run();

    void run();
    window.addEventListener(SYNC_DIRTY_EVENT, schedule);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      window.removeEventListener(SYNC_DIRTY_EVENT, schedule);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [userId]);

  return null;
}
