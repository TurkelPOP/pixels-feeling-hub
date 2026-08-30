/* eslint-disable prettier/prettier */
// eslint-disable-next-line prettier/prettier
import { motion } from "framer-motion";
import { Instagram, Facebook } from "lucide-react";

// High-precision official SVG icons for all social networks
function TwitchIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.429h-3.429l-3 3v-3H6.857V1.714h13.714z" />
    </svg>
  );
}

function YouTubeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function ThreadsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12.18 24h-.07c-3.32-.02-5.87-1.12-7.58-3.26C3 18.85 2.2 16.1 2.17 12.71v-.02c.03-3.4.83-6.14 2.36-8.04C6.24 2.5 8.79 1.4 12.11 1.38h.07c2.55.02 4.68.67 6.34 1.94 1.56 1.2 2.66 2.9 3.27 5.06l-2.05.57c-1.04-3.67-3.63-5.54-7.58-5.57-2.61.02-4.58.84-5.85 2.43-1.19 1.49-1.81 3.65-1.83 6.42.02 2.77.64 4.93 1.83 6.43 1.27 1.59 3.24 2.41 5.85 2.43 2.35-.02 3.91-.57 5.21-1.84 1.48-1.45 1.45-3.23 1-4.31-.27-.64-.76-1.17-1.42-1.57-.16 1.18-.54 2.13-1.13 2.85-.79.96-1.91 1.48-3.34 1.55-1.08.06-2.13-.2-2.94-.73-.96-.63-1.52-1.59-1.58-2.7-.05-1.08.38-2.07 1.21-2.79.79-.69 1.91-1.09 3.23-1.16.97-.05 1.88.02 2.72.19a4.4 4.4 0 0 0-.18-.92c-.34-1.07-1.13-1.74-2.46-1.74-.03 0-.06 0-.08 0-.88.05-1.42.31-2.06.83l-1.31-1.66c.85-.69 1.83-1.13 3.31-1.18 1.93-.09 3.34.73 4.13 2.34.41-.04.81-.07 1.18-.07 1.65 0 3.02.55 3.94 1.6.81.92 1.25 2.21 1.25 3.62 0 1.85-.85 3.52-2.36 4.81-1.4 1.21-3.18 1.83-5.46 1.86Zm.85-9.36c-.18 0-.36 0-.54.01-1.21.07-2.31.6-2.27 1.78.04.92.97 1.45 2.13 1.39 1.06-.06 2.66-.42 2.81-3.04a8.3 8.3 0 0 0-2.13-.14Z" />
    </svg>
  );
}

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43V8.55a8.16 8.16 0 0 0 4.77 1.52V6.69h-1.84Z" />
    </svg>
  );
}

const SOCIALS = [
  {
    label: "Twitch",
    href: "https://www.twitch.tv/turkelpop",
    icon: TwitchIcon,
    hoverColor: "#a855f7",
    glowColor: "rgba(168, 85, 247, 0.6)",
    bgGradient: "linear-gradient(135deg, rgba(145, 70, 255, 0.25), rgba(88, 28, 135, 0.35))",
  },
  {
    label: "YouTube",
    href: "https://www.youtube.com/playlist?list=PLf7hoWB9RRm6L2_2u7hVvoDcfFvsO9mwg",
    icon: YouTubeIcon,
    hoverColor: "#ff0033",
    glowColor: "rgba(255, 0, 51, 0.6)",
    bgGradient: "linear-gradient(135deg, rgba(255, 0, 51, 0.25), rgba(127, 29, 29, 0.35))",
  },
  {
    label: "Instagram",
    href: "https://www.instagram.com/_pixelsperspective_/",
    icon: InstagramIcon,
    hoverColor: "#ec4899",
    glowColor: "rgba(236, 72, 153, 0.6)",
    bgGradient: "linear-gradient(135deg, rgba(225, 48, 108, 0.25), rgba(245, 96, 64, 0.25))",
  },
  {
    label: "Facebook",
    href: "https://www.facebook.com/pixelsperspectivepodcast/",
    icon: FacebookIcon,
    hoverColor: "#3b82f6",
    glowColor: "rgba(59, 130, 246, 0.6)",
    bgGradient: "linear-gradient(135deg, rgba(24, 119, 242, 0.25), rgba(30, 58, 138, 0.35))",
  },
  {
    label: "Threads",
    href: "https://www.threads.com/@_pixelsperspective_",
    icon: ThreadsIcon,
    hoverColor: "#ffffff",
    glowColor: "rgba(255, 255, 255, 0.5)",
    bgGradient: "linear-gradient(135deg, rgba(255, 255, 255, 0.15), rgba(100, 116, 139, 0.25))",
  },
  {
    label: "TikTok",
    href: "https://www.tiktok.com/@pixels_perspective",
    icon: TikTokIcon,
    hoverColor: "#22d3ee",
    glowColor: "rgba(34, 211, 238, 0.6)",
    bgGradient: "linear-gradient(135deg, rgba(37, 244, 238, 0.2), rgba(254, 44, 85, 0.25))",
  },
];

export function Footer() {
  return (
    <footer className="relative border-t border-border py-8 mt-12">
      <div className="mx-auto max-w-6xl px-6 flex flex-col items-center gap-8">
        <div className="flex items-center font-normal text-xl">
          <span
            className="text-gradient text-4xl font-homebase tracking-wider text-white inline-block"
            style={{ letterSpacing: "0.08em" }}
          >
            Pixels Perspective
          </span>
        </div>

        <p className="text-sm text-white/70 text-center max-w-md">
          Le podcast qui joue avec vos émotions.
        </p>

        {/* Social Media Interactive Pills */}
        <ul className="flex items-center gap-3.5 sm:gap-4 flex-wrap justify-center">
          {SOCIALS.map((s, i) => (
            <motion.li
              key={s.label}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06, duration: 0.4 }}
            >
              <a
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.label}
                className="group relative flex size-13 items-center justify-center rounded-2xl glass-strong border border-white/10 transition-all duration-300 hover:-translate-y-1.5 hover:scale-105 overflow-hidden"
                style={{
                  boxShadow: "0 4px 20px -2px rgba(0, 0, 0, 0.4)",
                }}
              >
                {/* Ambient Brand Glow background on hover */}
                <span
                  aria-hidden
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{
                    background: s.bgGradient,
                    boxShadow: `inset 0 0 15px ${s.glowColor}, 0 0 25px ${s.glowColor}`,
                  }}
                />

                {/* Border highlight on hover */}
                <span
                  aria-hidden
                  className="absolute inset-0 rounded-2xl border border-transparent group-hover:border-white/20 transition-colors duration-300"
                />

                {/* Icon */}
                <s.icon
                  className="size-5.5 relative z-10 text-white/80 transition-all duration-300 group-hover:scale-110"
                  style={{
                    filter: "drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5))",
                  }}
                />
              </a>
            </motion.li>
          ))}
        </ul>

        <p className="text-xs text-muted-foreground text-center">
          © {new Date().getFullYear()} Pixels Perspective. All emotions reserved.
        </p>
      </div>
    </footer>
  );
}
