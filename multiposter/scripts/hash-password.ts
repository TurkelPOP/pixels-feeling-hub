// Calcule l'empreinte du mot de passe à mettre dans ADMIN_PASSWORD_HASH (mode serveur).
// Usage : node scripts/hash-password.ts   (le mot de passe est demandé, il n'est jamais enregistré)
// Même format que src/auth.ts : scrypt$N$r$p$sel$empreinte.
import { randomBytes, scryptSync } from "node:crypto";
import { createInterface } from "node:readline";

function hashPassword(password: string): string {
  const N = 2 ** 15;
  const r = 8;
  const p = 1;
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 32, { N, r, p, maxmem: 64 * 1024 * 1024 });
  return ["scrypt", N, r, p, salt.toString("base64url"), hash.toString("base64url")].join("$");
}

const rl = createInterface({ input: process.stdin });
process.stdout.write("Mot de passe (12 caractères minimum) : ");
for await (const line of rl) {
  const pw = line.trim();
  if (pw.length >= 12) {
    console.log("\n\nAjoute cette ligne dans les variables d'environnement :\n");
    console.log(`ADMIN_PASSWORD_HASH=${hashPassword(pw)}\n`);
    process.exit(0);
  }
  process.stdout.write("Trop court (12 caractères minimum). Mot de passe : ");
}
