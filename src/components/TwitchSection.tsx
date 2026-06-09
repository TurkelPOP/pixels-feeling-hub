import { motion } from "framer-motion";
import { Twitch } from "lucide-react";

const CHANNEL = "turkelpop";

export function TwitchSection() {
  // parent=localhost included as requested; also include current host for production
  const parents =
    typeof window !== "undefined"
      ? `&parent=${window.location.hostname}&parent=localhost`
      : "&parent=localhost";

  return (
    <section id="twitch" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-12 flex items-center gap-3"
        >
          <div>
            <p
              className="text-xs uppercase tracking-[0.3em] mb-3"
              style={{ color: "var(--twitch)" }}
            >
              Live Now
            </p>
            <h2 className="text-4xl sm:text-5xl font-bold flex items-center gap-3">
              <Twitch
                className="size-10"
                style={{ color: "var(--twitch)" }}
              />
              <span className="text-gradient">Stream & Chat</span>
            </h2>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="grid lg:grid-cols-[2fr_1fr] gap-5"
        >
          <div
            className="aspect-video rounded-3xl overflow-hidden border border-border"
            style={{
              boxShadow:
                "0 0 60px -10px oklch(0.6 0.22 295 / 0.5)",
            }}
          >
            <iframe
              title="Twitch stream"
              src={`https://player.twitch.tv/?channel=${CHANNEL}${parents}`}
              allowFullScreen
              className="size-full"
            />
          </div>
          <div className="h-[500px] lg:h-auto rounded-3xl overflow-hidden border border-border glass">
            <iframe
              title="Twitch chat"
              src={`https://www.twitch.tv/embed/${CHANNEL}/chat?darkpopout${parents}`}
              className="size-full"
            />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
