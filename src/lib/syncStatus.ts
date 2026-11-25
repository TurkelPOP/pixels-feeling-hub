import { useSyncExternalStore } from "react";

/**
 * off : rien à synchroniser (déconnecté, ou non configuré sur ce serveur)
 * syncing : échange en cours · synced : à jour · error : échec, nouvel essai au prochain changement
 * reconnect : la connexion Twitch date d'avant la synchronisation ou la session a expiré
 */
export type SyncStatus = "off" | "syncing" | "synced" | "reconnect" | "error";

let status: SyncStatus = "off";
const listeners = new Set<() => void>();

export function setSyncStatus(next: SyncStatus) {
  if (next === status) return;
  status = next;
  listeners.forEach((listener) => listener());
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => status,
    () => "off",
  );
}

export const SYNC_STATUS_LABELS: Record<SyncStatus, string> = {
  off: "",
  syncing: "Synchronisation en cours",
  synced: "Synchronisé entre vos appareils",
  reconnect: "Reconnectez-vous avec Twitch pour synchroniser vos appareils",
  error: "Synchronisation momentanément impossible",
};
