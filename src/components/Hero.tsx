/* eslint-disable prettier/prettier */
import { motion } from "framer-motion";
import { Headphones, Youtube, Menu, X, LogOut, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ppLogo from "@/assets/pp-logo.png";
import subwayLogo from "@/assets/subway-fc.png";
import { useTwitchAuth } from "@/lib/useTwitchAuth";

function TwitchNavIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.429h-3.429l-3 3v-3H6.857V1.714h13.714z" />
    </svg>
  );
}

type NavItem = {
  id: "podcast" | "youtube" | "twitch";
  label: string;
  menuLabel: string;
  ariaLabel: string;
  Icon: (props: { className?: string }) => React.ReactNode;
  iconColor: string;
  /** rgb triplets for the two gradient stops and the glow */
  from: string;
  to: string;
  glow: string;
  /** compact/full alpha for [from, to, glow] */
  compactAlpha: [number, number, number];
  fullAlpha: [number, number, number];
};

const NAV_ITEMS: NavItem[] = [
  {
    id: "podcast",
    label: "Écouter le podcast",
    menuLabel: "Écouter le podcast",
    ariaLabel: "Écouter le podcast",
    Icon: Headphones,
    iconColor: "text-cyan-300",
    from: "0, 191, 255",
    to: "120, 40, 200",
    glow: "0, 191, 255",
    compactAlpha: [0.25, 0.3, 0.5],
    fullAlpha: [0.2, 0.25, 0.45],
  },
  {
    id: "youtube",
    label: "Regarder sur YouTube",
    menuLabel: "Regarder sur YouTube",
    ariaLabel: "Regarder sur YouTube",
    Icon: Youtube,
    iconColor: "text-red-400",
    from: "255, 0, 51",
    to: "180, 0, 30",
    glow: "255, 0, 51",
    compactAlpha: [0.25, 0.35, 0.5],
    fullAlpha: [0.2, 0.3, 0.45],
  },
  {
    id: "twitch",
    label: "Lives Twitch",
    menuLabel: "Diffusions Twitch",
    ariaLabel: "Diffusions Twitch",
    Icon: TwitchNavIcon,
    iconColor: "text-purple-300",
    from: "145, 70, 255",
    to: "88, 28, 135",
    glow: "145, 70, 255",
    compactAlpha: [0.3, 0.4, 0.6],
    fullAlpha: [0.25, 0.35, 0.5],
  },
];

// Brand-tinted cartridge buttons: flat two-band fill, coloured border. Shadow comes from `pixel-btn`.
function navStyle(item: NavItem, compact: boolean): React.CSSProperties {
  const [a, b, g] = compact ? item.compactAlpha : item.fullAlpha;
  return {
    background: `linear-gradient(180deg, rgba(${item.from}, ${a}) 0 50%, rgba(${item.to}, ${b}) 50% 100%)`,
    borderColor: `rgba(${item.glow}, ${Math.min(g + 0.25, 1)})`,
  };
}

export function Hero() {
  const [open, setOpen] = useState(false);
  const burgerRef = useRef<HTMLButtonElement>(null);
  const { user, login, logout, isLoggingIn } = useTwitchAuth();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      burgerRef.current?.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const handleNavClick = (id: string) => {
    setOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <header
      id="top"
      className="relative overflow-hidden"
    >
      {/* Nav */}
      <motion.nav
        aria-label="Navigation principale"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="fixed top-4 left-1/2 z-50 w-[calc(100%-1.5rem)] max-w-6xl -translate-x-1/2 glass-strong"
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
      className="max-[660px]:hidden text-3xl font-homebase"
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
<div className="flex items-center justify-center gap-2 sm:gap-2.5">

  {/* Sous 700px : icônes rondes compactes */}
  {NAV_ITEMS.map((item) => (
    <button
      key={`compact-${item.id}`}
      onClick={() => handleNavClick(item.id)}
      className="max-[699px]:inline-flex hidden items-center justify-center size-10 pixel-btn cursor-pointer"
      style={navStyle(item, true)}
      aria-label={item.ariaLabel}
    >
      <item.Icon className={`size-4 ${item.iconColor}`} />
    </button>
  ))}

  {/* 700px et plus : boutons avec texte et couleurs de marque */}
  {NAV_ITEMS.map((item) => (
    <button
      key={`full-${item.id}`}
      onClick={() => handleNavClick(item.id)}
      className="max-[699px]:hidden inline-flex items-center gap-2 px-3 py-2 text-[11px] hud-label text-white pixel-btn whitespace-nowrap cursor-pointer"
      style={navStyle(item, false)}
    >
      <item.Icon className={`size-3.5 ${item.iconColor}`} />
      {item.label}
    </button>
  ))}

</div>         

{/* Right col : Twitch Auth + FC Subway + Burger mobile */}
<div className="flex items-center justify-end gap-2">

  {/* Twitch User Login or Logged-in Profile Badge */}
  {user ? (
    <div className="flex items-center gap-2 bg-purple-950/60 border-2 border-purple-500/50 px-2 py-1 text-xs text-white">
      <img
        src={user.profileImageUrl}
        alt={user.displayName}
        className="size-6 pixel-corners object-cover"
      />
      <span className="max-w-[100px] truncate hud-label text-[11px] hidden sm:inline">
        {user.displayName}
      </span>
      <button
        onClick={logout}
        title="Se déconnecter"
        aria-label="Se déconnecter de Twitch"
        className="p-2 hover:text-red-400 text-white/70 transition-colors cursor-pointer"
      >
        <LogOut className="size-3.5" />
      </button>
    </div>
  ) : (
    <button
      onClick={login}
      disabled={isLoggingIn}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] hud-label text-white pixel-btn whitespace-nowrap cursor-pointer"
      style={{
        background: "linear-gradient(180deg, rgba(145, 70, 255, 0.45) 0 50%, rgba(88, 28, 135, 0.6) 50% 100%)",
        borderColor: "rgba(145, 70, 255, 0.8)",
      }}
    >
      <TwitchNavIcon className="size-3.5 text-purple-200" />
      <span className="hidden sm:inline">Connexion Twitch</span>
    </button>
  )}

  <a
    href="https://papasubway.alwaysdata.net/"
    target="_blank"
    rel="noopener noreferrer"
    aria-label="Suivre le FC Subway - Lives FM26"
    className="group relative flex items-center justify-center w-9 h-9 transition-transform hover:scale-[1.05]"
  >
    <img
      src={subwayLogo}
      alt="FC Subway"
      className="h-full w-full object-contain transition-[filter] duration-300 group-hover:[filter:drop-shadow(0_0_14px_rgba(253,224,71,0.85))]"
      style={{
        clipPath: "polygon(50% 0%, 100% 12%, 100% 65%, 50% 100%, 0% 65%, 0% 12%)",
      }}
    />
    <span className="pointer-events-none absolute right-full mr-3 whitespace-nowrap glass-strong px-3 py-1.5 text-[11px] hud-label text-white opacity-0 translate-x-2 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0 group-focus-visible:opacity-100 group-focus-visible:translate-x-0">
      Suivre le FC Subway - Lives FM26
    </span>
  </a>

  <button
    ref={burgerRef}
    className="max-[699px]:flex min-[700px]:hidden items-center justify-center size-10 text-white"
    onClick={() => setOpen((s) => !s)}
    aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
    aria-expanded={open}
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
            {NAV_ITEMS.map((item) => (
              <button
                key={`menu-${item.id}`}
                onClick={() => handleNavClick(item.id)}
                className="inline-flex items-center justify-center gap-2.5 px-4 py-2.5 text-[11px] hud-label text-white pixel-btn cursor-pointer"
                style={navStyle(item, false)}
              >
                <item.Icon className={`size-4 ${item.iconColor}`} />
                {item.menuLabel}
              </button>
            ))}
          </motion.div>
        )}
      </motion.nav>

      {/* Hero content */}
      <div className="relative z-10 mx-auto flex h-auto max-w-6xl flex-col items-center justify-center px-5 sm:px-6 pt-32 sm:pt-36 pb-16 sm:pb-24 text-center">
        <motion.span
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.8, ease: "easeOut" }}
          className="mb-6 inline-flex items-center gap-2 glass px-4 py-1.5 text-[10px] sm:text-xs hud-label text-white/85 max-w-full"
        >
          <span aria-hidden className="text-accent blink-soft">▶</span>
          Nos émotions manette en main, dans un podcast.
        </motion.span>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.8, ease: "easeOut" }}
          className="font-homebase tracking-wider font-normal leading-[1.1] text-white w-full break-words"
          style={{
            fontSize: "clamp(2.25rem, 8vw, 6rem)",
            // Hard layered drop shadow, arcade title-screen style.
            textShadow: "4px 4px 0 var(--magenta), 8px 8px 0 oklch(0.25 0.12 290)",
          }}
        >
          Le podcast qui joue
          <br />
          avec vos émotions.
        </motion.h1>
      </div>
    </header>
  );
}
