// Premier lancement : crée le fichier .env (mot de passe + clé secrète) sans éditer de fichier.
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline";

const root = resolve(import.meta.dirname, "..");
const envPath = resolve(root, ".env");
if (existsSync(envPath)) process.exit(0);

console.log("\n=== Premier lancement de PTZ Posting ===\n");
const question = "Choisis un mot de passe pour ouvrir l'app (6 caractères minimum) : ";
const rl = createInterface({ input: process.stdin });
let password = "";
process.stdout.write(question);
for await (const line of rl) {
  password = line.trim();
  if (password.length >= 6) break;
  process.stdout.write(`Trop court. ${question}`);
}
rl.close();
if (password.length < 6) {
  console.error("\nAucun mot de passe saisi : relance le fichier pour recommencer.");
  process.exit(1);
}

const secret = randomBytes(32).toString("hex");
const template = readFileSync(resolve(root, ".env.example"), "utf8");
const env = template
  .replace(/^PUBLIC_URL=.*$/m, "PUBLIC_URL=http://127.0.0.1:3210")
  .replace(/^ADMIN_PASSWORD=.*$/m, `ADMIN_PASSWORD=${password}`)
  .replace(/^APP_SECRET=.*$/m, `APP_SECRET=${secret}`);
writeFileSync(envPath, env);

console.log("\nRéglages enregistrés dans le fichier .env.");
console.log("Garde une copie de ce fichier : il contient ta clé secrète (APP_SECRET).\n");
