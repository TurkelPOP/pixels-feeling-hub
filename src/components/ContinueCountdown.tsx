/* eslint-disable prettier/prettier */
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

/** Compte à rebours « Continuer ? » de la page 404 : Entrée ramène à l'accueil. */
export function ContinueCountdown() {
  const navigate = useNavigate();
  const [count, setCount] = useState(9);

  useEffect(() => {
    if (count <= 0) return;
    const id = setTimeout(() => setCount((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [count]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") void navigate({ to: "/" });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate]);

  return (
    <div className="mt-6">
      {/* Le décompte est décoratif : les lecteurs d'écran lisent seulement la consigne. */}
      <p className="sr-only">Appuyez sur Entrée pour revenir à l'accueil.</p>
      <p aria-hidden className="text-[11px] hud-label text-white/80">
        {count > 0 ? (
          <>
            Continuer ?{" "}
            <span className="font-homebase text-3xl align-middle text-white" style={{ textShadow: "0 4px 10px oklch(0.1 0.05 290 / 0.55)" }}>
              {count}
            </span>
          </>
        ) : (
          <span className="blink-soft">▶ Appuyez sur Entrée</span>
        )}
      </p>
    </div>
  );
}
