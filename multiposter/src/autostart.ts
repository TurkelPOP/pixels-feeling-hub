// Démarrage automatique avec Windows (désactivé par défaut), activable depuis l'app.
// Activer = déposer un petit script dans le dossier « Démarrage » de la session Windows,
// qui lance l'app en arrière-plan. Désactiver = le supprimer.
import { existsSync } from "node:fs";
import { unlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const APP_DIR = resolve(import.meta.dirname, "..");
const HIDDEN_LAUNCHER = join(APP_DIR, "scripts", "multiposter-cache.vbs");

function startupDir(): string | null {
  if (process.platform !== "win32" && !process.env.AUTOSTART_TEST_DIR) return null;
  if (process.env.AUTOSTART_TEST_DIR) return process.env.AUTOSTART_TEST_DIR;
  const appData = process.env.APPDATA;
  return appData ? join(appData, "Microsoft", "Windows", "Start Menu", "Programs", "Startup") : null;
}

const entryPath = () => {
  const dir = startupDir();
  return dir ? join(dir, "Multiposter.vbs") : null;
};

export function autostartStatus() {
  const entry = entryPath();
  return { supported: !!entry, enabled: !!entry && existsSync(entry) };
}

export async function setAutostart(enabled: boolean) {
  const entry = entryPath();
  if (!entry) throw new Error("Le démarrage automatique n'est disponible que sur Windows.");
  if (!enabled) {
    await unlink(entry).catch(() => {});
    return autostartStatus();
  }
  const quoted = HIDDEN_LAUNCHER.replaceAll('"', '""');
  const script = `' Lance PTZ Posting en arrière-plan à l'ouverture de session (créé depuis l'app).\r\nCreateObject("WScript.Shell").Run "wscript.exe ""${quoted}""", 0, False\r\n`;
  // UTF-16 avec BOM : Windows Script Host lit ainsi correctement les chemins accentués.
  await writeFile(entry, Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(script, "utf16le")]));
  return autostartStatus();
}
