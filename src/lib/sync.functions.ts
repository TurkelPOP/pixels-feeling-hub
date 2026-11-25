import { createServerFn } from "@tanstack/react-start";

import { currentUserId, endSession, isSameOrigin, sessionConfigured } from "./session.server";
import { syncPayloadSchema, type SyncPayload } from "./sync.merge";
import { getSyncStore } from "./sync.store.server";
import { isRateLimited } from "./twitch.server";

export type SyncResult =
  | { status: "ok"; data: SyncPayload }
  /** Pas de session valide : l'utilisateur doit se reconnecter avec Twitch. */
  | { status: "unauthenticated" }
  /** Synchronisation non configurée sur ce serveur (pas de SESSION_SECRET ou pas de base). */
  | { status: "disabled" }
  | { status: "error" };

/**
 * Envoie l'état local, reçoit l'état fusionné (le plus récent gagne). L'identité vient uniquement du
 * cookie de session signé : le client ne peut pas choisir l'utilisateur dont il lit ou écrit les données.
 */
export const syncExchange = createServerFn({ method: "POST" })
  .inputValidator(syncPayloadSchema)
  .handler(async ({ data }): Promise<SyncResult> => {
    if (!sessionConfigured()) return { status: "disabled" };
    const userId = currentUserId();
    if (!userId || !isSameOrigin()) return { status: "unauthenticated" };
    if (isRateLimited("sync", 120, 60_000)) return { status: "error" };

    const store = await getSyncStore();
    if (!store) return { status: "disabled" };
    try {
      return { status: "ok", data: store.exchange(userId, data) };
    } catch (error) {
      console.error("[sync] exchange failed", error);
      return { status: "error" };
    }
  });

/** Supprime les données synchronisées de l'utilisateur connecté (droit à l'effacement). */
export const deleteSyncData = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ status: "ok" | "unauthenticated" | "disabled" | "error" }> => {
    if (!sessionConfigured()) return { status: "disabled" };
    const userId = currentUserId();
    if (!userId || !isSameOrigin()) return { status: "unauthenticated" };

    const store = await getSyncStore();
    if (!store) return { status: "disabled" };
    try {
      store.remove(userId);
      return { status: "ok" };
    } catch (error) {
      console.error("[sync] delete failed", error);
      return { status: "error" };
    }
  },
);

/** Ferme la session côté serveur (déconnexion). Les données synchronisées restent stockées. */
export const endSyncSession = createServerFn({ method: "POST" }).handler(async (): Promise<{ ok: true }> => {
  endSession();
  return { ok: true };
});
