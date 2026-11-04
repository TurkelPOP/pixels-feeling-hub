// Alertes facultatives vers un webhook (Discord, Slack ou ntfy), pour être prévenu
// d'un échec de publication ou d'un brouillon Canva prêt, même la nuit.
import { config } from "./config.ts";

export async function alert(message: string): Promise<void> {
  const url = config.alertWebhookUrl;
  if (!url) return;
  try {
    const isNtfy = /ntfy/.test(new URL(url).host);
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": isNtfy ? "text/plain; charset=utf-8" : "application/json" },
      // Discord lit `content`, Slack lit `text`.
      body: isNtfy ? message : JSON.stringify({ content: message.slice(0, 1900), text: message }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (e) {
    console.error("[alerte] envoi impossible :", e instanceof Error ? e.message : e);
  }
}

export const appLink = (hash = "queue") => `${config.publicUrl}/#${hash}`;
