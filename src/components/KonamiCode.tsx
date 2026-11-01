/* eslint-disable prettier/prettier */
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

const SEQUENCE = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
const DURATION_MS = 4500;
const PIXEL_COUNT = 36;
const COLORS = ["var(--magenta)", "var(--twitch)", "oklch(0.85 0.15 200)", "oklch(0.9 0.15 95)"];

type Pixel = { left: number; size: number; delay: number; duration: number; color: string };

/** Easter egg : ↑ ↑ ↓ ↓ ← → ← → B A déclenche une pluie de pixels et un message arcade. */
export function KonamiCode() {
  const [pixels, setPixels] = useState<Pixel[] | null>(null);
  const progress = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Pas de déclenchement pendant la saisie (recherche d'épisode, etc.).
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;

      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (key === SEQUENCE[progress.current]) {
        progress.current += 1;
      } else {
        progress.current = key === SEQUENCE[0] ? 1 : 0;
      }
      if (progress.current < SEQUENCE.length) return;

      progress.current = 0;
      // Valeurs tirées au déclenchement, côté client seulement : pas d'écart d'hydratation.
      setPixels(
        Array.from({ length: PIXEL_COUNT }, (_, i) => ({
          left: Math.random() * 100,
          size: 6 + Math.round(Math.random() * 8),
          delay: Math.random() * 1.2,
          duration: 2 + Math.random() * 1.5,
          color: COLORS[i % COLORS.length],
        })),
      );
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setPixels(null), DURATION_MS);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      clearTimeout(timer.current);
    };
  }, []);

  return (
    <AnimatePresence>
      {pixels && (
        <motion.div
          key="konami"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="pointer-events-none fixed inset-0 z-[80] overflow-hidden"
        >
          <div aria-hidden className="motion-reduce:hidden">
            {pixels.map((p, i) => (
              <span
                key={i}
                className="pixel-fall absolute top-0"
                style={{
                  left: `${p.left}%`,
                  width: p.size,
                  height: p.size,
                  background: p.color,
                  animationDelay: `${p.delay}s`,
                  animationDuration: `${p.duration}s`,
                }}
              />
            ))}
          </div>
          <p
            role="status"
            className="absolute left-1/2 top-24 -translate-x-1/2 glass-strong px-5 py-3 text-center text-xs hud-label text-white whitespace-nowrap"
          >
            <span aria-hidden className="text-accent">▶ </span>Code Konami ! +30 vies
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
