/* eslint-disable prettier/prettier */
import { motion, useScroll } from "framer-motion";

export function ScrollProgress() {
  // Motion value drives the transform directly: no React re-render per scroll event.
  const { scrollYProgress } = useScroll();

  return (
    <motion.div
      aria-hidden
      className="fixed top-0 left-0 right-0 z-[60] h-[5px] origin-left pointer-events-none segmented"
      style={{
        scaleX: scrollYProgress,
        background: "var(--gradient-accent)",
      }}
    />
  );
}
