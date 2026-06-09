import { motion } from "framer-motion";
import { Twitter, Instagram, MessageCircle, Twitch } from "lucide-react";

const SOCIALS = [
  {
    label: "Twitter",
    href: "https://twitter.com/_pixelsperspective_",
    icon: Twitter,
  },
  {
    label: "Instagram",
    href: "https://instagram.com/_pixelsperspective_",
    icon: Instagram,
  },
  {
    label: "Discord",
    href: "#",
    icon: MessageCircle,
  },
  {
    label: "Twitch",
    href: "https://twitch.tv/turkelpop",
    icon: Twitch,
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

        <ul className="flex items-center gap-4">
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
