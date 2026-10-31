/* eslint-disable prettier/prettier */
import { motion } from "framer-motion";

// High-precision official SVG icons for all social networks
function TwitchIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.429h-3.429l-3 3v-3H6.857V1.714h13.714z" />
    </svg>
  );
}

function YouTubeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

function InstagramIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  );
}

function FacebookIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function ThreadsIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.33-3.082.88-.76 2.119-1.207 3.583-1.291a13.853 13.853 0 0 1 3.02.142c-.126-.742-.375-1.332-.75-1.757-.513-.586-1.308-.883-2.359-.89h-.029c-.844 0-1.992.232-2.721 1.32L7.734 7.847c.98-1.454 2.568-2.256 4.478-2.256h.044c3.194.02 5.097 1.975 5.287 5.388.108.046.216.094.321.142 1.49.7 2.58 1.761 3.154 3.07.797 1.82.871 4.79-1.548 7.158-1.85 1.81-4.094 2.628-7.277 2.65Zm1.003-11.69c-.242 0-.487.007-.739.021-1.836.103-2.98.946-2.916 2.143.067 1.256 1.452 1.839 2.784 1.767 1.224-.065 2.818-.543 3.086-3.71a10.5 10.5 0 0 0-2.215-.221z" />
    </svg>
  );
}

function TikTokIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
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
    <footer className="relative border-t-2 border-[var(--panel-edge)] py-8 mt-12">
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
                className="group relative flex size-13 items-center justify-center pixel-btn overflow-hidden"
                style={{ background: "var(--panel-strong)" }}
              >
                {/* Brand colour fill on hover */}
                <span
                  aria-hidden
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                  style={{
                    background: s.bgGradient,
                    boxShadow: `inset 0 0 0 2px ${s.glowColor}`,
                  }}
                />

                {/* Icon */}
                <s.icon
                  className="size-5.5 relative z-10 text-white/80 transition-colors duration-150 group-hover:text-white"
                  style={{
                    filter: "drop-shadow(2px 2px 0 rgba(0, 0, 0, 0.6))",
                  }}
                />
              </a>
            </motion.li>
          ))}
        </ul>

        <p className="text-[11px] hud-label text-muted-foreground text-center">
          © {new Date().getFullYear()} Pixels Perspective. Tous droits réservés.
        </p>
      </div>
    </footer>
  );
}
