// Builds a standalone Node server in .output/ (no node_modules needed at runtime).
// Cross-platform equivalent of: NITRO_PRESET=node-server vite build && cp deploy/start.mjs .output/
import { execSync } from "node:child_process";
import { copyFileSync } from "node:fs";

execSync("npx vite build", {
  stdio: "inherit",
  env: { ...process.env, NITRO_PRESET: "node-server" },
});
copyFileSync("deploy/start.mjs", ".output/start.mjs");
console.log(
  "\nOK : uploadez le contenu de .output/ (start.mjs, server/, public/) sur l'hébergeur.",
);
