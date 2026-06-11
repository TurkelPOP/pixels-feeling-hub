import { motion } from "framer-motion";
import { Instagram, Facebook } from "lucide-react";

// Inline SVG components for icons not available in lucide-react
function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43V8.55a8.16 8.16 0 0 0 4.77 1.52V6.69h-1.84Z" />
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

const SOCIALS = [
  {
    label: "Instagram",
    href: "https://www.instagram.com/pixelsperspective/",
    icon: Instagram,
  },
  {
    label: "Facebook",
    href: "https://www.facebook.com/pixelsperspectivepodcast/",
    icon: Facebook,
  },
  {
    label: "Threads",
    href: "https://www.threads.com/@pixelsperspective",
    icon: ThreadsIcon,
  },
  {
    label: "TikTok",
    href: "https://www.tiktok.com/@pixels_perspective",
    icon: TikTokIcon,
  },
];

export function Footer() {
  return (
    <footer className="relative border-t border-border py-16 mt-10">
      <div className="mx-auto max-w-6xl px-6 flex flex-col items-center gap-8">
        <div className="flex items-center gap-2 font-bold text-xl">
          <span className="inline-block size-2.5 rounded-full bg-primary glow-magenta" />
          <span className="text-gradient">Pixels Perspective</span>
        </div>

        <p className="text-sm text-muted-foreground text-center max-w-md">
          Feeling the games, one episode at a time. Join the conversation.
        </p>

        <ul className="flex items-center gap-4 flex-wrap justify-center">
          {SOCIALS.map((s, i) => (
            <motion.li
              key={s.label}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
            >
              <a
                href={s.href}
                target="_blank"
                rel="noreferrer"
                aria-label={s.label}
                className="group relative inline-flex size-12 items-center justify-center rounded-full glass-strong transition-all hover:scale-110"
                style={{
                  boxShadow: "0 0 20px -5px oklch(0.72 0.22 330 / 0.4)",
                }}
              >
                <span
                  aria-hidden
                  className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{
                    boxShadow:
                      "0 0 30px 0 oklch(0.78 0.18 330 / 0.7), inset 0 0 20px 0 oklch(0.78 0.18 200 / 0.3)",
                  }}
                />
                <s.icon className="size-5 relative z-10 text-foreground group-hover:text-primary transition-colors" />
              </a>
            </motion.li>
          ))}
        </ul>

        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} Pixels Perspective. All emotions reserved.
        </p>
      </div>
    </footer>
  );
}
