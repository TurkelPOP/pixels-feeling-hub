/* eslint-disable prettier/prettier */
import { AnimatePresence, motion } from "framer-motion";
import { Play, Pause, X } from "lucide-react";

interface StickyPlayerProps {
  visible: boolean;
  title: string;
  playing: boolean;
  progress: number;
  duration: number;
  onToggle: () => void;
  onClose: () => void;
  cover?: string;
}

export function StickyPlayer({
  visible,
  title,
  playing,
  progress,
  duration,
  onToggle,
  onClose,
  cover,
}: StickyPlayerProps) {
  const pct = duration ? (progress / duration) * 100 : 0;
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[min(92vw,520px)]"
        >
          <div className="glass rounded-full pl-2 pr-3 py-2 flex items-center gap-3 shadow-2xl">
            {cover ? (
              <img
                src={cover}
                alt=""
                className="size-10 rounded-full object-cover shrink-0"
              />
            ) : (
              <div
                className="size-10 rounded-full shrink-0"
                style={{ background: "var(--gradient-primary)" }}
              />
            )}
            <button
              onClick={onToggle}
              aria-label={playing ? "Pause" : "Play"}
              className="inline-flex items-center justify-center size-9 shrink-0 rounded-full bg-primary text-primary-foreground hover:scale-105 transition-transform"
            >
              {playing ? (
                <Pause className="size-4" />
              ) : (
                <Play className="size-4 ml-0.5" />
              )}
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium truncate">{title}</p>
              <div className="relative h-1 mt-1 rounded-full bg-muted/40 overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    width: `${pct}%`,
                    background: "var(--gradient-accent)",
                  }}
                />
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close mini player"
              className="shrink-0 size-7 inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
            >
              <X className="size-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function PlayingBars({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-end gap-[2px] h-4 ${className}`}
      aria-label="Playing"
    >
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-[3px] rounded-sm bg-white"
          animate={{ height: ["30%", "100%", "50%", "80%", "30%"] }}
          transition={{
            duration: 0.9,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.15,
          }}
          style={{ height: "30%" }}
        />
      ))}
    </span>
  );
}
