/* eslint-disable prettier/prettier */
import { useEffect, useState, useCallback } from "react";
import type { TwitchUser } from "./twitch-auth.functions";
import { getTwitchAuthUrl } from "./twitch-auth.functions";

const STATE_KEY = "twitch_oauth_state";

/** Random value tying the Twitch callback to a login started in this tab (OAuth CSRF protection). */
function createOAuthState(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const state = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  sessionStorage.setItem(STATE_KEY, state);
  return state;
}

/** True only if `state` matches the one stored at login; single use. */
export function consumeOAuthState(state: string | null): boolean {
  const expected = sessionStorage.getItem(STATE_KEY);
  sessionStorage.removeItem(STATE_KEY);
  return !!state && !!expected && state === expected;
}

export function useTwitchAuth() {
  const [user, setUser] = useState<TwitchUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);

  const loadUserFromStorage = useCallback(() => {
    try {
      const stored = localStorage.getItem("twitch_user");
      if (stored) {
        setUser(JSON.parse(stored) as TwitchUser);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Older versions stored the Twitch access token client-side: purge it.
    localStorage.removeItem("twitch_token");
    loadUserFromStorage();

    const handleAuthChange = () => {
      loadUserFromStorage();
    };

    window.addEventListener("twitch-auth-change", handleAuthChange);
    window.addEventListener("storage", handleAuthChange);
    return () => {
      window.removeEventListener("twitch-auth-change", handleAuthChange);
      window.removeEventListener("storage", handleAuthChange);
    };
  }, [loadUserFromStorage]);

  const login = async () => {
    try {
      setIsLoggingIn(true);
      const redirectUri = `${window.location.origin}/auth/twitch/callback`;
      const state = createOAuthState();
      
      // Always built server-side so the requested scopes (follows, subs, moderation) stay in one place.
      const { url } = await getTwitchAuthUrl({ data: { redirectUri, state } });
      window.location.href = url;
    } catch (err) {
      console.error("Login initiation error:", err);
      alert("Impossible d'initialiser la connexion Twitch. Vérifiez la configuration.");
      setIsLoggingIn(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("twitch_user");
    localStorage.removeItem("twitch_token");
    setUser(null);
    window.dispatchEvent(new Event("twitch-auth-change"));
  };

  return { user, loading, isLoggingIn, login, logout };
}
