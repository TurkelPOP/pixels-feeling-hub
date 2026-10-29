/* eslint-disable prettier/prettier */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { handleTwitchCallback } from "@/lib/twitch-auth.functions";
import { consumeOAuthState } from "@/lib/useTwitchAuth";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/auth/twitch/callback")({
  component: TwitchCallbackComponent,
});

function TwitchCallbackComponent() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    async function processCallback() {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get("code");
        const error = urlParams.get("error");
        const errorDescription = urlParams.get("error_description");
        const stateMatches = consumeOAuthState(urlParams.get("state"));

        if (error) {
          setStatus("error");
          setErrorMessage(
            error === "access_denied"
              ? "Connexion Twitch annulée. Vous avez refusé l'accès."
              : errorDescription || `Erreur Twitch : ${error}`
          );
          return;
        }

        // Reject callbacks not started from this browser (login CSRF).
        if (!stateMatches) {
          setStatus("error");
          setErrorMessage("Session de connexion invalide ou expirée. Relancez la connexion Twitch.");
          return;
        }

        if (!code) {
          setStatus("error");
          setErrorMessage("Code d'autorisation Twitch manquant dans l'URL de retour.");
          return;
        }

        const redirectUri = `${window.location.origin}/auth/twitch/callback`;

        const result = await handleTwitchCallback({ data: { code, redirectUri } });

        // Persist session in localStorage
        localStorage.setItem("twitch_user", JSON.stringify(result.user));

        // Notify all useTwitchAuth hooks across tabs
        window.dispatchEvent(new Event("twitch-auth-change"));

        setStatus("success");
        setTimeout(() => {
          navigate({ to: "/" });
        }, 1200);
      } catch (err) {
        console.error("[Twitch Callback] Error:", err);
        setStatus("error");
        setErrorMessage(
          err instanceof Error
            ? err.message
            : "Une erreur inattendue est survenue lors de la connexion Twitch."
        );
      }
    }

    processCallback();
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md w-full rounded-3xl glass-strong border border-white/10 p-8 text-center flex flex-col items-center gap-4">
        {status === "loading" && (
          <>
            <Loader2 className="size-12 text-purple-400 animate-spin" />
            <h2 className="text-xl font-semibold text-white">Connexion à Twitch en cours...</h2>
            <p className="text-sm text-muted-foreground">
              Vérification sécurisée de votre compte Twitch.
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle2 className="size-12 text-green-400 animate-bounce" />
            <h2 className="text-xl font-semibold text-white">Connexion réussie !</h2>
            <p className="text-sm text-muted-foreground">
              Bienvenue sur Pixels Perspective. Redirection en cours...
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <AlertCircle className="size-12 text-red-400" />
            <h2 className="text-xl font-semibold text-white">Échec de la connexion</h2>
            <p className="text-sm text-red-300 max-w-xs">{errorMessage}</p>
            <div className="flex flex-col gap-2 mt-2 w-full">
              <button
                onClick={() => navigate({ to: "/" })}
                className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium text-sm transition-all"
              >
                Retour à l'accueil
              </button>
              <p className="text-[11px] text-white/40 mt-1">
                Si le problème persiste, vérifiez que l'URL de retour est bien enregistrée dans la console Twitch.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
