/* eslint-disable prettier/prettier */
import { useState } from "react";

import { deleteSyncData } from "@/lib/sync.functions";
import { setSyncStatus, useSyncStatus } from "@/lib/syncStatus";
import { useTwitchAuth } from "@/lib/useTwitchAuth";

/** Effacement des données stockées sur le serveur (droit à l'effacement). Visible seulement quand la synchronisation est active. */
export function SyncDataControls() {
  const { user } = useTwitchAuth();
  const status = useSyncStatus();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!user || (status !== "synced" && status !== "syncing" && status !== "error" && !message)) return null;

  const remove = async () => {
    const ok = window.confirm(
      "Supprimer vos données synchronisées (positions d'écoute, épisodes écoutés, vitesse) du serveur ?\n\n" +
        "Elles restent sur cet appareil. La synchronisation sera désactivée jusqu'à votre prochaine connexion Twitch.",
    );
    if (!ok) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await deleteSyncData();
      if (result.status === "ok") {
        setSyncStatus("reconnect");
        setMessage("Données supprimées du serveur. La synchronisation est désactivée jusqu'à votre prochaine connexion.");
      } else {
        setMessage("Suppression impossible pour le moment. Réessayez dans un instant.");
      }
    } catch {
      setMessage("Suppression impossible pour le moment. Réessayez dans un instant.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2 text-center">
      {status !== "reconnect" && (
        <button
          type="button"
          onClick={remove}
          disabled={busy}
          className="text-[11px] hud-label text-white/70 underline underline-offset-4 hover:text-white disabled:opacity-50"
        >
          Supprimer mes données synchronisées
        </button>
      )}
      {message && (
        <p role="status" className="max-w-md text-xs text-white/70">
          {message}
        </p>
      )}
    </div>
  );
}
