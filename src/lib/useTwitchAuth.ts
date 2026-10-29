/* eslint-disable prettier/prettier */
import { useEffect, useState, useCallback } from "react";
import type { TwitchUser } from "./twitch-auth.functions";
import { getTwitchAuthUrl } from "./twitch-auth.functions";

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
      
      const clientId = import.meta.env.VITE_TWITCH_CLIENT_ID;
      if (clientId) {
        const params = new URLSearchParams({
          client_id: clientId,
          redirect_uri: redirectUri,
          response_type: "code",
          scope: "user:read:email",
          force_verify: "false",
        });
        window.location.href = `https://id.twitch.tv/oauth2/authorize?${params.toString()}`;
        return;
      }

      const { url } = await getTwitchAuthUrl({ data: { redirectUri } });
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
