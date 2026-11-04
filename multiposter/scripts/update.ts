// Mise à jour depuis GitHub : télécharge la dernière version de la branche et remplace les
// fichiers de l'app, sans toucher à .env, data/ ni node_modules/.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, normalize, relative, resolve, sep } from "node:path";
import { createInterface } from "node:readline";
import { inflateRawSync } from "node:zlib";

const APP = resolve(import.meta.dirname, "..");
if (existsSync(join(APP, ".env"))) process.loadEnvFile(join(APP, ".env"));
const REPO = process.env.UPDATE_REPO ?? "turkelpop/pixels-feeling-hub";
const BRANCH = process.env.UPDATE_BRANCH ?? "ccr-174b691b-7a3vf3";
const SUBDIR = "multiposter/";
const DATA = resolve(APP, process.env.DATA_DIR ?? "data");
const VERSION_FILE = join(DATA, "version.json");
/** Jamais écrasés ni supprimés. */
const PROTECTED = [".env", "data/", "node_modules/"];
/** Dossiers entièrement synchronisés : un fichier retiré du dépôt est supprimé ici aussi. */
const SYNCED_DIRS = ["src/", "public/", "scripts/"];
const UA = { "User-Agent": "multiposter-updater" };

const isProtected = (rel: string) => PROTECTED.some((p) => rel === p || rel.startsWith(p));

/** Lecteur ZIP minimal (méthodes « stockée » et « deflate »), sans dépendance. */
function unzip(buf: Buffer): Map<string, Buffer> {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 66_000); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("archive ZIP illisible");
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out = new Map<string, Buffer>();
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("archive ZIP corrompue");
    const method = buf.readUInt16LE(p + 10);
    const csize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    p += 46 + nameLen + extraLen + commentLen;
    if (name.endsWith("/")) continue;
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = buf.subarray(start, start + csize);
    if (method === 0) out.set(name, Buffer.from(raw));
    else if (method === 8) out.set(name, inflateRawSync(raw));
    else throw new Error(`compression non prise en charge (${method}) pour ${name}`);
  }
  return out;
}

function listFiles(dir: string, base = dir): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((f) => {
    const full = join(dir, f);
    return statSync(full).isDirectory() ? listFiles(full, base) : [relative(base, full).split(sep).join("/")];
  });
}

async function ask(question: string): Promise<string> {
  if (!process.stdin.isTTY) return "";
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((r) => rl.question(question, (a) => (rl.close(), r(a.trim().toLowerCase()))));
}

async function main() {
  const force = process.argv.includes("--force");
  console.log(`\n=== Mise à jour de Multiposter ===\nSource : github.com/${REPO} (branche ${BRANCH})\n`);

  const res = await fetch(`https://api.github.com/repos/${REPO}/commits/${encodeURIComponent(BRANCH)}`, { headers: UA });
  if (!res.ok) throw new Error(`GitHub ne répond pas (HTTP ${res.status}). Vérifie ta connexion Internet.`);
  const commit = (await res.json()) as { sha: string; commit: { message: string; committer: { date: string } } };
  const current = existsSync(VERSION_FILE) ? JSON.parse(readFileSync(VERSION_FILE, "utf8")) : null;
  const when = new Date(commit.commit.committer.date).toLocaleString("fr-FR");
  if (current?.sha === commit.sha && !force) {
    console.log(`Tu as déjà la dernière version (du ${when}).`);
    return false;
  }
  console.log(`Nouvelle version du ${when} : ${commit.commit.message.split("\n")[0]}`);

  console.log("Téléchargement…");
  const zipRes = await fetch(`https://codeload.github.com/${REPO}/zip/${commit.sha}`, { headers: UA });
  if (!zipRes.ok) throw new Error(`Téléchargement impossible (HTTP ${zipRes.status}).`);
  const entries = unzip(Buffer.from(await zipRes.arrayBuffer()));

  // Les fichiers de l'app sont dans <dossier-racine>/multiposter/ de l'archive.
  const files = new Map<string, Buffer>();
  for (const [name, data] of entries) {
    const i = name.indexOf("/");
    const inner = name.slice(i + 1);
    if (!inner.startsWith(SUBDIR)) continue;
    const rel = normalize(inner.slice(SUBDIR.length)).split(sep).join("/");
    if (!rel || rel.startsWith("..") || rel.startsWith("/") || isProtected(rel)) continue;
    files.set(rel, data);
  }
  if (!files.has("package.json") || !files.has("src/server.ts")) throw new Error("archive inattendue : rien n'a été modifié.");

  const before = (f: string) => (existsSync(join(APP, f)) ? readFileSync(join(APP, f)) : null);
  const depsChanged = ["package.json", "package-lock.json"].some((f) => !before(f)?.equals(files.get(f) ?? Buffer.alloc(0)));

  let written = 0;
  for (const [rel, data] of files) {
    const dest = join(APP, rel);
    if (before(rel)?.equals(data)) continue;
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, data);
    written++;
  }

  // Supprime ce qui a disparu du dépôt : dossiers synchronisés, et fichiers de l'ancienne version.
  const stale = new Set<string>(SYNCED_DIRS.flatMap((d) => listFiles(join(APP, d)).map((f) => d + f)));
  for (const f of current?.files ?? []) stale.add(f);
  let removed = 0;
  for (const rel of stale) {
    if (files.has(rel) || isProtected(rel) || rel.startsWith("..")) continue;
    if (existsSync(join(APP, rel))) {
      rmSync(join(APP, rel));
      removed++;
    }
  }

  if (depsChanged || !existsSync(join(APP, "node_modules"))) {
    console.log("Mise à jour des composants (npm)…");
    const npm = process.platform === "win32" ? "npm.cmd" : "npm";
    const r = spawnSync(npm, ["install", "--omit=dev", "--no-audit", "--no-fund"], { cwd: APP, stdio: "inherit", shell: process.platform === "win32" });
    if (r.status !== 0) throw new Error("npm install a échoué : relance la mise à jour.");
  }

  mkdirSync(DATA, { recursive: true });
  writeFileSync(VERSION_FILE, JSON.stringify({ sha: commit.sha, date: commit.commit.committer.date, message: commit.commit.message.split("\n")[0], files: [...files.keys()] }, null, 2));
  console.log(`\nMise à jour terminée : ${written} fichier(s) mis à jour, ${removed} supprimé(s).`);
  console.log("Ton fichier .env et tes données (dossier data) n'ont pas été modifiés.");
  return true;
}

try {
  const updated = await main();
  if (updated && process.platform === "win32" && process.argv.includes("--offer-restart")) {
    const a = await ask("\nRelancer Multiposter maintenant ? (O/n) ");
    if (a === "" || a === "o" || a === "oui") {
      spawn("cmd", ["/c", "start", "", "Demarrer Multiposter.cmd"], { cwd: APP, detached: true, stdio: "ignore" }).unref();
    }
  }
} catch (e) {
  console.error(`\nLa mise à jour a échoué : ${e instanceof Error ? e.message : e}`);
  console.error("Ton installation actuelle n'a pas été modifiée, sauf si le message indique le contraire.");
  process.exitCode = 1;
}
