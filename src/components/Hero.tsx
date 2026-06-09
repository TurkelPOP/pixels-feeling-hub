import { motion } from "framer-motion";
import { Headphones, Twitch, Menu, X } from "lucide-react";
import { useState } from "react";

const NAV = [
  { label: "Podcast", href: "#podcast" },
  { label: "YouTube", href: "#youtube" },
  { label: "Twitch", href: "#twitch" },
];

export function Hero() {
  const [open, setOpen] = useState(false);

  return (
    <header
      id="top"
      className="relative min-h-screen overflow-hidden"
      style={{ background: "var(--gradient-hero)" }}
    >
      {/* Nav */}
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="fixed top-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-6xl -translate-x-1/2 rounded-2xl glass-strong"
      >
        <div className="flex items-center justify-between px-5 py-3">
          <a href="#top" className="flex items-center gap-2 font-bold tracking-tight">
            <span className="inline-block size-2.5 rounded-full bg-primary glow-magenta" />
            <span className="text-gradient text-lg">Pixels Perspective</span>
          </a>
          <ul className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            {NAV.map((n) => (
              <li key={n.href}>
                <a
                  href={n.href}
                  className="transition-colors hover:text-foreground"
                >
                  {n.label}
                </a>
              </li>
            ))}
          </ul>
          <a
            href="#podcast"
            className="hidden md:inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground glow-hover"
          >
            <Headphones className="size-4" />
            Listen
          </a>
          <button
            className="md:hidden text-foreground"
            onClick={() => setOpen((s) => !s)}
            aria-label="Toggle menu"
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
        {open && (
          <motion.ul
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            className="md:hidden overflow-hidden border-t border-border px-5 py-4 flex flex-col gap-4 text-sm"
          >
            {NAV.map((n) => (
              <li key={n.href}>
                <a href={n.href} onClick={() => setOpen(false)}>
                  {n.label}
                </a>
              </li>
            ))}
          </motion.ul>
        )}
      </motion.nav>

      {/* Hero content */}
      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center px-6 pt-32 pb-20 text-center">
        <motion.span
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-6 inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-xs uppercase tracking-[0.2em] text-muted-foreground"
        >
          <span className="inline-block size-1.5 rounded-full bg-accent animate-pulse" />
          A podcast about feeling games
        </motion.span>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.8 }}
          className="text-5xl sm:text-7xl md:text-8xl font-bold text-gradient leading-[0.95]"
        >
          The emotions
          <br />
          behind the
          <br />
          controller.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="mt-8 max-w-2xl text-base sm:text-lg text-muted-foreground"
        >
          Pixels Perspective explores what we really feel when we play — the
          joy, the rage, the heartbreak. Real conversations about the human
          side of video games.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="mt-10 flex flex-col sm:flex-row gap-4"
        >
          <a
            href="#podcast"
            className="group inline-flex items-center justify-center gap-2 rounded-full bg-primary px-7 py-3.5 text-sm font-semibold text-primary-foreground glow-magenta transition-transform hover:scale-105"
          >
            <Headphones className="size-4" />
            Listen to the Podcast
          </a>
          <a
            href="#twitch"
            className="inline-flex items-center justify-center gap-2 rounded-full glass-strong px-7 py-3.5 text-sm font-semibold text-foreground transition-transform hover:scale-105"
            style={{ boxShadow: "var(--shadow-glow-cyan)" }}
          >
            <Twitch className="size-4" style={{ color: "var(--twitch)" }} />
            Watch Live on Twitch
          </a>
        </motion.div>

        {/* Floating orbs */}
        <motion.div
          aria-hidden
          animate={{ y: [0, -20, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          className="absolute left-[10%] top-1/3 size-32 rounded-full bg-primary/20 blur-3xl"
        />
        <motion.div
          aria-hidden
          animate={{ y: [0, 20, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute right-[10%] bottom-1/4 size-40 rounded-full bg-accent/20 blur-3xl"
        />
      </div>
    </header>
  );
}
