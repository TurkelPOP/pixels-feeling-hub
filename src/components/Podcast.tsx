import { motion } from "framer-motion";
import { Headphones, ExternalLink } from "lucide-react";

const SHOW_URL = "https://open.spotify.com/show/"; // placeholder

const EPISODES = [
  {
    n: 12,
    title: "When a game makes you cry",
    desc: "Why the ending of certain games hits harder than films.",
    duration: "48 min",
  },
  {
    n: 11,
    title: "The rage of the controller",
    desc: "Anger, frustration and what they reveal about us as players.",
    duration: "52 min",
  },
  {
    n: 10,
    title: "Nostalgia in 8 bits",
    desc: "How childhood pixels still shape our adult emotions.",
    duration: "44 min",
  },
];

export function Podcast() {
  return (
    <section id="podcast" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-14 flex items-end justify-between flex-wrap gap-4"
        >
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-accent mb-3">
              The Podcast
            </p>
            <h2 className="text-4xl sm:text-5xl font-bold text-gradient">
              Latest Episodes
            </h2>
          </div>
          <a
            href={SHOW_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            All episodes <ExternalLink className="size-3.5" />
          </a>
        </motion.div>

        {/* Featured episode */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="rounded-3xl glass-strong p-6 sm:p-10 mb-10 glow-magenta"
        >
          <div className="grid md:grid-cols-[1fr_2fr] gap-8 items-center">
            <div
              className="aspect-square rounded-2xl relative overflow-hidden flex items-center justify-center"
              style={{ background: "var(--gradient-primary)" }}
            >
              <Headphones className="size-24 text-white/90" strokeWidth={1.2} />
              <div className="absolute inset-0 bg-gradient-to-tr from-black/40 to-transparent" />
              <span className="absolute top-4 left-4 text-xs uppercase tracking-[0.2em] text-white/80">
                Episode 13 · New
              </span>
            </div>
            <div>
              <h3 className="text-2xl sm:text-3xl font-bold mb-3">
                The first time a game broke your heart
              </h3>
              <p className="text-muted-foreground mb-6 text-sm sm:text-base leading-relaxed">
                We trace those unforgettable emotional shocks — from Aerith to
                Lee Everett — and why pixels can hit us harder than reality.
              </p>

              {/* Spotify embed acts as the player */}
              <div className="rounded-xl overflow-hidden border border-border">
                <iframe
                  title="Spotify player"
                  src="https://open.spotify.com/embed/show/4rOoJ6Egrf8K2IrywzwOMk?utm_source=generator&theme=0"
                  width="100%"
                  height="152"
                  frameBorder={0}
                  allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                  loading="lazy"
                />
              </div>
            </div>
          </div>
        </motion.div>

        {/* Previous episodes grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {EPISODES.map((ep, i) => (
            <motion.article
              key={ep.n}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="rounded-2xl glass p-6 glow-hover group cursor-pointer"
            >
              <div className="flex items-center justify-between mb-4">
                <span
                  className="text-xs font-mono px-2 py-1 rounded-md"
                  style={{
                    background: "oklch(0.72 0.22 330 / 0.15)",
                    color: "var(--magenta)",
                  }}
                >
                  EP {ep.n}
                </span>
                <span className="text-xs text-muted-foreground">
                  {ep.duration}
                </span>
              </div>
              <h3 className="font-semibold text-lg mb-2 group-hover:text-primary transition-colors">
                {ep.title}
              </h3>
              <p className="text-sm text-muted-foreground line-clamp-2">
                {ep.desc}
              </p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
