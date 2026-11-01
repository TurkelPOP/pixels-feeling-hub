/* eslint-disable prettier/prettier */
import { Tv } from "lucide-react";
import { useEffect, useState } from "react";

const STORAGE_KEY = "pp_crt";

/** Active ou coupe les lignes de balayage CRT. Le choix est mémorisé et appliqué avant l'affichage (script du root). */
export function CrtToggle() {
  const [on, setOn] = useState(true);

  // Lu après l'hydratation : le serveur ignore la préférence du visiteur.
  useEffect(() => {
    setOn(document.documentElement.dataset.crt !== "off");
  }, []);

  const toggle = () => {
    const next = !on;
    setOn(next);
    if (next) delete document.documentElement.dataset.crt;
    else document.documentElement.dataset.crt = "off";
    try {
      localStorage.setItem(STORAGE_KEY, next ? "on" : "off");
    } catch {
      // Stockage indisponible : le réglage vaut pour la page en cours seulement.
    }
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={toggle}
      className="inline-flex h-10 items-center gap-2 px-3 text-[11px] hud-label text-white pixel-btn"
    >
      <Tv className="size-4" aria-hidden />
      Effet CRT
      <span aria-hidden className={on ? "text-accent" : "text-white/60"}>
        {on ? "ON" : "OFF"}
      </span>
    </button>
  );
}
