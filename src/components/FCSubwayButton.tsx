/* eslint-disable prettier/prettier */
import { motion } from "framer-motion";
import subwayLogo from "@/assets/subway-fc.png";

export function FCSubwayButton() {
  return (
    <motion.a
      href="https://papasubway.alwaysdata.net"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Suivre le FC Subway - Lives FM26"
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 1, duration: 0.6, ease: "easeOut" }}
      whileHover={{ scale: 1.05 }}
      className="group fixed bottom-5 right-5 z-50 flex items-center justify-center"
      style={{
        width: 72,
        height: 72,
        filter: "drop-shadow(0 0 0 transparent)",
        transition: "filter 0.3s ease",
      }}
    >
      <img
        src={subwayLogo}
        alt="FC Subway"
        className="h-full w-full object-contain transition-[filter] duration-300 group-hover:[filter:drop-shadow(0_0_18px_rgba(253,224,71,0.85))]"
        style={{
          clipPath:
            "polygon(50% 0%, 100% 12%, 100% 65%, 50% 100%, 0% 65%, 0% 12%)",
        }}
      />
      <span className="pointer-events-none absolute right-full mr-3 whitespace-nowrap rounded-md glass-strong px-3 py-1.5 text-xs font-medium text-white opacity-0 translate-x-2 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0">
        Suivre le FC Subway - Lives FM26
      </span>
    </motion.a>
  );
}
