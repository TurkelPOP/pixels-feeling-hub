/* eslint-disable prettier/prettier */
import { useEffect, useState, useCallback } from "react";
import { useTwitchAuth } from "./useTwitchAuth";

export type ProgressStatus = "started" | "completed";

export interface MediaHistoryItem {
  id: string;
  type: "podcast" | "youtube" | "twitch";
  status: ProgressStatus;
  progress?: number; // 0-100%
  updatedAt: string;
}

type HistoryMap = Record<string, MediaHistoryItem>;

function getStorageKey(userId?: string | null): string {
  return userId ? `pp_history_${userId}` : "pp_history_guest";
}

export function getMediaHistory(userId?: string | null): HistoryMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    return raw ? (JSON.parse(raw) as HistoryMap) : {};
  } catch {
    return {};
  }
}

export function saveMediaStatus(
  id: string,
  type: "podcast" | "youtube" | "twitch",
  status: ProgressStatus,
  userId?: string | null,
  progress?: number,
) {
  if (typeof window === "undefined") return;
  try {
    const key = getStorageKey(userId);
    const history = getMediaHistory(userId);
    
    // If setting to started but already completed, keep completed unless explicitly changed
    const existing = history[id];
    if (existing?.status === "completed" && status === "started") {
      return;
    }

    history[id] = {
      id,
      type,
      status,
      progress: progress ?? (status === "completed" ? 100 : existing?.progress ?? 10),
      updatedAt: new Date().toISOString(),
    };

    localStorage.setItem(key, JSON.stringify(history));
    window.dispatchEvent(new Event("pp-media-history-change"));
  } catch (e) {
    console.error("Failed to save media history:", e);
  }
}

export function useMediaHistory() {
  const { user } = useTwitchAuth();
  const userId = user?.id;
  const [history, setHistory] = useState<HistoryMap>(() => getMediaHistory(userId));

  const refreshHistory = useCallback(() => {
    setHistory(getMediaHistory(userId));
  }, [userId]);

  useEffect(() => {
    refreshHistory();

    const handleStorage = () => refreshHistory();
    window.addEventListener("pp-media-history-change", handleStorage);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("pp-media-history-change", handleStorage);
      window.removeEventListener("storage", handleStorage);
    };
  }, [refreshHistory]);

  const markStarted = (id: string, type: "podcast" | "youtube" | "twitch", progress?: number) => {
    saveMediaStatus(id, type, "started", userId, progress);
  };

  const markCompleted = (id: string, type: "podcast" | "youtube" | "twitch") => {
    saveMediaStatus(id, type, "completed", userId, 100);
  };

  const getStatus = (id: string): MediaHistoryItem | undefined => {
    return history[id];
  };

  return { history, getStatus, markStarted, markCompleted };
}
