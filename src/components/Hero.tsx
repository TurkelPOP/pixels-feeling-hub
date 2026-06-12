/* eslint-disable prettier/prettier */
import { motion } from "framer-motion";
import { Headphones, Youtube, Menu, X } from "lucide-react";
import { useState } from "react";

const NAV = [
  { label: "Podcast", href: "#podcast" },
  { label: "YouTube", href: "#youtube" },
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
        <div className="grid grid-cols-3 items-center px-3 my-2">
          <a href="#top" className="flex items-center overflow-hidden">
            <span
              className="text-3xl font-['Homebase']"
              style={{
                transformOrigin: 'left center',
                paddingLeft: '2px',
                width: '300px',
                letterSpacing: '0.05em',
                display: 'inline-block',
                color: 'white',
              }}
            >
              Pixels Perspective
            </span>
          </a>

          {/* Boutons desktop */}
          <div className="hidden md:flex items-center justify-center gap-3">
            <a
              href="#podcast"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-bold text-white-foreground transition-transform hover:scale-102 whitespace-nowrap"
              style={{ boxShadow: "var(--shadow-glow-cyan)" }}
            >
              <Headphones className="size-3" />
              Écouter le podcast
            </a>
            <a
              href="#youtube"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById("youtube")?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-bold text-white-foreground transition-transform hover:scale-102 whitespace-nowrap"
              style={{ boxShadow: "var(--shadow-glow-cyan)" }}
                          >
              <Youtube className="size-3 text-accent" />
              Regarder sur YouTube
            </a>
          </div>

          <div className="flex justify-end">
            <button
              className="md:hidden text-foreground"
              onClick={() => setOpen((s) => !s)}
              aria-label="Toggle menu"
            >
              {open ? <X /> : <Menu />}
            </button>
          </div>
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
      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center px-6 pt-20 pb-8 text-center">
        <motion.span
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-6 inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-xs uppercase tracking-[0.2em] text-white-muted-foreground"
        >
          <span className="inline-block" />
          Un podcast sur ce que vous ressentez vraiment en jouant.
        </motion.span>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.8 }}
          className="text-5xl sm:text-7xl md:text-8xl font-normal leading-[0.95] text-white w-full break-words"
        >
          Le podcast qui joue
          <br />
          avec vos émotions.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="mt-8 max-w-2xl text-base sm:text-lg text-white-muted-foreground"
        >
          Pixels Perspective explore ce que nous ressentons vraiment manette en main. Joie, peur, tristesse, colère, amour.
          Le côté réellement humain du jeu vidéo.
        </motion.p>

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