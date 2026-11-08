// Maintenance (propriétaire uniquement) : sauvegardes de la base et mise à jour de l'app depuis
// l'interface, sans console SSH.
// - Sauvegarde automatique chaque nuit (les 14 dernières sont gardées), ou à la demande.
// - Restauration : appliquée au redémarrage (voir db.ts), l'ancienne base est gardée de côté.
// - Mise à jour : « git pull » puis redémarrage ; dépendances réinstallées si elles ont changé.
import { execFile } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";

import type { Context, Hono } from "hono";

import { alert } from "./alerts.ts";
import { confirmIdentity, currentUser, logEvent } from "./auth.ts";
import { config } from "./config.ts";
import { db } from "./db.ts";

export const backupDir = resolve(config.dataDir, "backups");
mkdirSync(backupDir, { recursive: true, mode: 0o700 });
try { chmodSync(backupDir, 0o700); } catch { /* système sans droits Unix */ }
const KEEP = Number(process.env.BACKUP_KEEP ?? 14);
const NAME_RE = /^(ptz-\d{4}-\d{2}-\d{2}(?:-\d{6})?|avant-restauration-[\dT-]+Z?)\.db$/;
const APP_DIR = process.cwd();

const run = (cmd: string, args: string[], timeoutMs = 120_000) =>
  new Promise<string>((ok, ko) =>
    execFile(cmd, args, { cwd: APP_DIR, timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } }, (err, stdout, stderr) =>
      err ? ko(new Error(String(stderr || err.message).trim().slice(0, 600))) : ok(stdout.trim()),
    ),
  );

/** Copie cohérente de la base (même en cours d'utilisation). */
export function backupNow(label?: string): string {
  const d = new Date();
  const day = d.toISOString().slice(0, 10);
  const name = label ? `ptz-${day}-${d.toISOString().slice(11, 19).replace(/:/g, "")}.db` : `ptz-${day}.db`;
  const path = resolve(backupDir, name);
  if (existsSync(path)) unlinkSync(path);
  db.exec(`VACUUM INTO '${path.replace(/'/g, "''")}'`);
  try { chmodSync(path, 0o600); } catch { /* idem */ } // lisible par l'app seulement
  // On ne garde que les KEEP plus récentes (hors copies « avant restauration »).
  const old = listBackups().filter((b) => b.name.startsWith("ptz-")).slice(KEEP);
  for (const b of old) unlinkSync(resolve(backupDir, b.name));
  return name;
}

export function listBackups() {
  return readdirSync(backupDir)
    .filter((f) => NAME_RE.test(f))
    .map((name) => {
      const st = statSync(resolve(backupDir, name));
      return { name, size: st.size, at: st.mtimeMs };
    })
    .sort((a, b) => b.at - a.at);
}

/** Sauvegarde automatique : une par nuit (vers 3 h, heure du serveur), plus une au démarrage s'il n'y en a pas du jour. */
export function startBackups() {
  // Sauvegardes existantes : lisibles par l'app seulement.
  for (const b of listBackups()) try { chmodSync(resolve(backupDir, b.name), 0o600); } catch { /* idem */ }
  const daily = () => {
    try {
      const today = `ptz-${new Date().toISOString().slice(0, 10)}.db`;
      if (!existsSync(resolve(backupDir, today))) console.log(`[sauvegarde] ${backupNow()}`);
    } catch (e) {
      console.error("[sauvegarde]", e);
      void alert(`⚠️ Sauvegarde automatique de PTZ Posting impossible : ${e instanceof Error ? e.message : e}`);
    }
  };
  setTimeout(daily, 2 * 60_000).unref?.();
  setInterval(() => { if (new Date().getHours() === 3) daily(); }, 30 * 60_000).unref?.();
}

/** Redémarre l'app : l'hébergeur relance le processus (alwaysdata, systemd, Docker « restart »). */
const restartSoon = () => setTimeout(() => process.exit(0), 1200);

export function registerMaintenanceApi(api: Hono, sendFile: (c: Context, path: string, cache?: string, type?: string) => Response | Promise<Response>) {
  const owner = (c: Context) => (currentUser(c)?.role === "owner" ? null : c.json({ error: "Réservé au propriétaire." }, 403));

  api.get("/maintenance", async (c) => {
    const denied = owner(c);
    if (denied) return denied;
    let version: { commit: string; date: string; subject: string; branch: string } | null = null;
    try {
      const [commit, date, subject] = (await run("git", ["log", "-1", "--format=%h%n%cI%n%s"])).split("\n");
      version = { commit, date, subject, branch: await run("git", ["rev-parse", "--abbrev-ref", "HEAD"]) };
    } catch {
      /* pas un dépôt git (copie manuelle) */
    }
    return c.json({ version, backups: listBackups(), keep: KEEP });
  });

  /** Dépôt d'origine accepté pour les mises à jour : GitHub en HTTPS uniquement. */
  // (On vérifie l'adresse réellement utilisée, après les éventuelles réécritures de la config git.)
  // UPDATE_REMOTE (variable du serveur) peut autoriser une autre source précise.
  const remoteOk = (url: string) =>
    /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+?(\.git)?$/.test(url.replace(/\/\/[^@/]+@/, "//")) || (!!process.env.UPDATE_REMOTE && url === process.env.UPDATE_REMOTE);

  api.post("/maintenance/update/check", async (c) => {
    const denied = owner(c);
    if (denied) return denied;
    try {
      const remote = (await run("git", ["remote", "get-url", "origin"])).replace(/\/\/[^@/]+@/, "//"); // sans identifiants
      if (!remoteOk(remote)) return c.json({ error: `Origine des mises à jour refusée : ${remote} (seul GitHub en HTTPS est accepté).` }, 400);
      await run("git", ["fetch", "--quiet", "origin"], 60_000);
      const upstream = await run("git", ["rev-parse", "@{u}"]);
      const branch = await run("git", ["rev-parse", "--abbrev-ref", "@{u}"]);
      const log = await run("git", ["log", "--format=%h%x09%cI%x09%an%x09%s", "HEAD..@{u}"]);
      const commits = log ? log.split("\n").map((l) => { const [commit, date, author, subject] = l.split("\t"); return { commit, date, author, subject }; }) : [];
      const files = commits.length ? (await run("git", ["diff", "--name-only", "HEAD", "@{u}"])).split("\n").filter(Boolean) : [];
      return c.json({ commits, files, target: upstream, remote, branch });
    } catch (e) {
      return c.json({ error: `Vérification impossible : ${e instanceof Error ? e.message : e}` }, 502);
    }
  });

  api.post("/maintenance/update/apply", async (c) => {
    const denied = owner(c);
    if (denied) return denied;
    const b = await c.req.json<{ code?: string; target?: string }>().catch(() => ({}) as { code?: string; target?: string });
    const err = confirmIdentity(c, b.code);
    if (err) return c.json({ error: err }, 403);
    const target = String(b.target ?? "");
    if (!/^[0-9a-f]{40}$/.test(target)) return c.json({ error: "Vérifie d'abord les mises à jour." }, 400);
    const who = currentUser(c)!.name;
    try {
      // On installe EXACTEMENT la version vue lors de la vérification (pas une plus récente
      // arrivée entre-temps), et seulement si c'est une suite directe de la version actuelle.
      await run("git", ["merge-base", "--is-ancestor", target, "@{u}"]).catch(() => { throw new Error("cette version n'est plus sur la branche suivie"); });
      backupNow("avant-maj"); // filet de sécurité avant toute mise à jour
      const before = await run("git", ["rev-parse", "HEAD"]);
      await run("git", ["merge", "--ff-only", "--quiet", target], 120_000);
      const after = await run("git", ["rev-parse", "HEAD"]);
      if (before === after) return c.json({ ok: true, updated: false });
      const changed = await run("git", ["diff", "--name-only", before, after]);
      // Dépendances : versions exactes du fichier verrouillé, sans exécuter de script d'installation.
      if (/(^|\/)package(-lock)?\.json$/m.test(changed)) await run("npm", ["ci", "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund"], 5 * 60_000);
      logEvent(c, "app_updated", who, `${before.slice(0, 7)} → ${after.slice(0, 7)}`);
      void alert(`🔄 PTZ Posting mis à jour par « ${who} » (${before.slice(0, 7)} → ${after.slice(0, 7)}). Redémarrage…`);
      restartSoon();
      return c.json({ ok: true, updated: true, restarting: true });
    } catch (e) {
      return c.json({ error: `Mise à jour impossible : ${e instanceof Error ? e.message : e}` }, 500);
    }
  });

  api.post("/maintenance/restart", (c) => {
    const denied = owner(c);
    if (denied) return denied;
    logEvent(c, "app_restart", currentUser(c)!.name);
    restartSoon();
    return c.json({ ok: true });
  });

  api.post("/maintenance/backups", (c) => {
    const denied = owner(c);
    if (denied) return denied;
    try {
      const name = backupNow("manuel");
      logEvent(c, "backup_created", currentUser(c)!.name, name);
      return c.json({ ok: true, name });
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : "Sauvegarde impossible" }, 500);
    }
  });

  api.post("/maintenance/backups/:name/download", async (c) => {
    const denied = owner(c);
    if (denied) return denied;
    const name = c.req.param("name");
    if (!NAME_RE.test(name)) return c.notFound();
    const { code } = await c.req.json<{ code?: string }>().catch(() => ({ code: "" }));
    const err = confirmIdentity(c, code);
    if (err) return c.json({ error: err }, 403);
    logEvent(c, "backup_downloaded", currentUser(c)!.name, name);
    void alert(`📦 Sauvegarde « ${name} » téléchargée par « ${currentUser(c)!.name} ».`);
    c.header("Content-Disposition", `attachment; filename="${name}"`);
    return sendFile(c, resolve(backupDir, name), "no-store", "application/octet-stream");
  });

  api.post("/maintenance/backups/:name/restore", async (c) => {
    const denied = owner(c);
    if (denied) return denied;
    const name = c.req.param("name");
    const { code } = await c.req.json<{ code?: string }>().catch(() => ({ code: "" }));
    const err = confirmIdentity(c, code);
    if (err) return c.json({ error: err }, 403);
    if (!NAME_RE.test(name) || !existsSync(resolve(backupDir, name))) return c.json({ error: "Sauvegarde introuvable" }, 404);
    copyFileSync(resolve(backupDir, name), resolve(config.dataDir, "restore-pending.db"));
    try { chmodSync(resolve(config.dataDir, "restore-pending.db"), 0o600); } catch { /* idem */ }
    logEvent(c, "backup_restored", currentUser(c)!.name, name);
    void alert(`♻️ Restauration de la sauvegarde « ${name} » demandée par « ${currentUser(c)!.name} ». Redémarrage…`);
    restartSoon();
    return c.json({ ok: true, restarting: true });
  });
}
