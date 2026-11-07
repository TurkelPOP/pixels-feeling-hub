// Tailscale automatique : au démarrage, si Tailscale est installé et connecté, l'app ouvre
// elle-même les deux seuls chemins publics (/oauth et /media) et utilise l'adresse ts.net.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

import { config } from "./config.ts";

export interface TailscaleState {
  /** off = désactivé (TAILSCALE=off ou autre adresse publique configurée). */
  mode: "off" | "auto";
  installed: boolean;
  loggedIn: boolean;
  host: string | null;
  funnelOk: boolean;
  /** Lien à ouvrir une fois pour autoriser Funnel / HTTPS sur ton compte Tailscale. */
  enableUrl: string | null;
  error: string | null;
}

export const tailscaleState: TailscaleState = {
  mode: "off",
  installed: false,
  loggedIn: false,
  host: null,
  funnelOk: false,
  enableUrl: null,
  error: null,
};

const isLocal = (url: string) => /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url);
const explicitPublic = process.env.PUBLIC_URL?.trim();

function binary(): string | null {
  if (process.env.TAILSCALE_BIN) return process.env.TAILSCALE_BIN;
  const win = "C:\\Program Files\\Tailscale\\tailscale.exe";
  if (process.platform === "win32" && existsSync(win)) return win;
  return "tailscale";
}

/** Lance la commande tailscale, avec un délai maximum (la 1re activation de Funnel attend). */
const ENABLE_LINK = /https:\/\/login\.tailscale\.com\/\S+/;

function run(args: string[], timeoutMs = 15_000): Promise<{ code: number | null; out: string }> {
  return new Promise((resolve) => {
    const bin = binary();
    if (!bin) return resolve({ code: -1, out: "" });
    let out = "";
    let done = false;
    const finish = (code: number | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve({ code, out });
    };
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(bin, args, { windowsHide: true });
    } catch {
      return resolve({ code: -1, out: "" });
    }
    const timer = setTimeout(() => {
      child.kill();
      finish(null);
    }, timeoutMs);
    // Tailscale attend que Funnel soit activé : dès que le lien d'activation s'affiche, on arrête.
    const onData = (d: Buffer) => {
      out += d;
      if (ENABLE_LINK.test(out)) {
        child.kill();
        finish(null);
      }
    };
    child.stdout?.on("data", onData);
    child.stderr?.on("data", onData);
    child.on("error", () => finish(-1));
    child.on("close", (code) => finish(code));
  });
}

function funnelHasPaths(json: string, host: string): boolean {
  try {
    const cfg = JSON.parse(json);
    const handlers = cfg?.Web?.[`${host}:443`]?.Handlers ?? {};
    const ok = (path: string) => String(handlers[path]?.Proxy ?? "").includes(`:${config.port}${path}`);
    return ok("/oauth") && ok("/media") && !!cfg?.AllowFunnel?.[`${host}:443`];
  } catch {
    return false;
  }
}

/** Configure Tailscale si possible et met à jour l'adresse publique de l'app. */
export async function setupTailscale(onHost: (host: string) => void): Promise<TailscaleState> {
  const s = tailscaleState;
  const wanted =
    process.env.TAILSCALE !== "off" && (!explicitPublic || isLocal(explicitPublic.replace(/\/+$/, "")) || /\.ts\.net\/?$/.test(explicitPublic));
  s.mode = wanted ? "auto" : "off";
  if (!wanted) return s;

  const st = await run(["status", "--json"]);
  s.installed = st.code !== -1;
  if (!s.installed) {
    s.error = null;
    return s;
  }
  let self: { DNSName?: string } | undefined;
  let backend = "";
  try {
    const j = JSON.parse(st.out);
    backend = j.BackendState;
    self = j.Self;
  } catch {
    /* sortie inattendue */
  }
  s.loggedIn = backend === "Running";
  if (!s.loggedIn) {
    s.error = "Tailscale est installé mais pas connecté : ouvre Tailscale et connecte-toi.";
    return s;
  }
  s.host = (self?.DNSName ?? "").replace(/\.$/, "") || null;
  if (!s.host) {
    s.error = "Adresse Tailscale introuvable.";
    return s;
  }

  const current = await run(["funnel", "status", "--json"]);
  if (!funnelHasPaths(current.out, s.host)) {
    for (const path of ["/oauth", "/media"]) {
      const r = await run(["funnel", "--bg", "--set-path", path, `http://127.0.0.1:${config.port}${path}`], 25_000);
      const link = r.out.match(ENABLE_LINK)?.[0];
      if (link) {
        s.enableUrl = link;
        s.error = "Funnel n'est pas encore activé sur ton compte Tailscale : ouvre le lien, accepte, puis clique sur « Réessayer ».";
        return s;
      }
      if (r.code !== 0) {
        s.error = `Tailscale a refusé d'ouvrir ${path} : ${r.out.trim().split("\n").pop() ?? "erreur inconnue"}`;
        return s;
      }
    }
  }
  s.funnelOk = funnelHasPaths((await run(["funnel", "status", "--json"])).out, s.host);
  s.enableUrl = null;
  s.error = s.funnelOk ? null : "Les chemins /oauth et /media n'apparaissent pas dans la configuration Tailscale.";
  if (s.funnelOk) onHost(s.host);
  return s;
}
