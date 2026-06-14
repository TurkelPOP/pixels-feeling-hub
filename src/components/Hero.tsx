/* eslint-disable prettier/prettier */
import { motion } from "framer-motion";
import { Headphones, Youtube, Menu, X } from "lucide-react";
import { useState } from "react";
import ppLogo from "@/assets/pp-logo.png";
import subwayLogo from "@/assets/subway-fc.png";

export function Hero() {
  const [open, setOpen] = useState(false);

  const handleNavClick = (id: string) => {
    setOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <header
      id="top"
      className="relative overflow-hidden"
      style={{ background: "var(--gradient-hero)" }}
    >
      {/* Nav */}
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="fixed top-4 left-1/2 z-50 w-[calc(100%-1.5rem)] max-w-6xl -translate-x-1/2 rounded-2xl glass-strong"
      >
        <div className="grid grid-cols-[auto_1fr_auto] items-center px-3 sm:px-4 py-2 gap-2">
  {/* Logo */}
  <a href="#top" className="flex items-center">
    {/* Logo PP : sous 700px */}
    <img
      src={ppLogo}
      alt="Pixels Perspective"
      className="max-[660px]:block hidden h-10 w-auto"
    />
    {/* Texte Homebase : 700px et plus */}
    <span
      className="max-[660px]:hidden text-3xl font-['Homebase']"
      style={{
        paddingLeft: '2px',
        letterSpacing: '0.05em',
        color: 'white',
        whiteSpace: 'nowrap',
      }}
    >
      Pixels Perspective
    </span>
  </a>

{/* Center buttons */}
<div className="flex items-center justify-center gap-3">

  {/* Sous 700px : icônes rondes */}
  <button
    onClick={() => handleNavClick("podcast")}
    className="max-[699px]:inline-flex hidden items-center justify-center rounded-full bg-primary w-10 h-10 transition-transform hover:scale-[1.03]"
    style={{ boxShadow: "var(--shadow-glow-cyan)" }}
    aria-label="Écouter le podcast"
  >
    <Headphones className="size-4" />
  </button>
  <button
    onClick={() => handleNavClick("youtube")}
    className="max-[699px]:inline-flex hidden items-center justify-center rounded-full bg-primary w-10 h-10 transition-transform hover:scale-[1.03]"
    style={{ boxShadow: "var(--shadow-glow-cyan)" }}
    aria-label="Regarder sur YouTube"
  >
    <Youtube className="size-4 text-accent" />
  </button>

  {/* 700px et plus : boutons avec texte */}
  <button
    onClick={() => handleNavClick("podcast")}
    className="max-[699px]:hidden inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-bold text-white transition-transform hover:scale-[1.03] whitespace-nowrap"
    style={{ boxShadow: "var(--shadow-glow-cyan)" }}
  >
    <Headphones className="size-3" />
    Écouter le podcast
  </button>
  <button
    onClick={() => handleNavClick("youtube")}
    className="max-[699px]:hidden inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-bold text-white transition-transform hover:scale-[1.03] whitespace-nowrap"
    style={{ boxShadow: "var(--shadow-glow-cyan)" }}
  >
    <Youtube className="size-3 text-accent" />
    Regarder sur YouTube
  </button>

</div>         

{/* Right col : FC Subway + Burger mobile */}
<div className="flex items-center justify-end gap-2">

  <a
    href="https://papasubway.alwaysdata.net/"
    target="_blank"
    rel="noopener noreferrer"
    aria-label="Suivre le FC Subway - Lives FM26"
    className="group relative flex items-center justify-center w-10 h-10 transition-transform hover:scale-[1.05]"
  >
    <img
      src={subwayLogo}
      alt="FC Subway"
      className="h-full w-full object-contain transition-[filter] duration-300 group-hover:[filter:drop-shadow(0_0_14px_rgba(253,224,71,0.85))]"
      style={{
        clipPath: "polygon(50% 0%, 100% 12%, 100% 65%, 50% 100%, 0% 65%, 0% 12%)",
      }}
    />
    <span className="pointer-events-none absolute right-full mr-3 whitespace-nowrap rounded-md glass-strong px-3 py-1.5 text-xs font-medium text-white opacity-0 translate-x-2 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0">
      Suivre le FC Subway - Lives FM26
    </span>
  </a>

  <button
    className="max-[699px]:flex min-[700px]:hidden text-white p-1.5"
    onClick={() => setOpen((s) => !s)}
    aria-label="Toggle menu"
  >
    {open ? <X /> : <Menu />}
  </button>

</div>

</div>

        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            className="min-[700px]:hidden overflow-hidden border-t border-border px-4 py-4 flex flex-col gap-3"
          >
            <button
              onClick={() => handleNavClick("podcast")}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-xs font-bold text-white"
              style={{ boxShadow: "var(--shadow-glow-cyan)" }}
            >
              <Headphones className="size-3.5" />
              Écouter le podcast
            </button>
            <button
              onClick={() => handleNavClick("youtube")}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-xs font-bold text-white"
              style={{ boxShadow: "var(--shadow-glow-cyan)" }}
            >
              <Youtube className="size-3.5 text-accent" />
              Regarder sur YouTube
            </button>
          </motion.div>
        )}
      </motion.nav>

      {/* Hero content */}
      <div className="relative z-10 mx-auto flex h-auto max-w-6xl flex-col items-center justify-center px-5 sm:px-6 pt-32 sm:pt-36 pb-16 sm:pb-24 text-center">
        <motion.span
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.8, ease: "easeOut" }}
          className="mb-6 inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-[10px] sm:text-xs tracking-[0.18em] text-white/80 max-w-full"
        >
          Nos émotions manette en main, dans un podcast.
        </motion.span>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.8, ease: "easeOut" }}
          className="font-normal leading-[1] text-white w-full break-words"
          style={{ fontSize: "clamp(2.25rem, 8vw, 6rem)" }}
        >
          Le podcast qui joue
          <br />
          avec vos émotions.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.8, ease: "easeOut" }}
          className="mt-6 sm:mt-8 max-w-2xl text-sm sm:text-base md:text-lg text-white/70"
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
