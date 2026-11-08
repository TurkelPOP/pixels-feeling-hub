// Service worker de PTZ Posting : rend l'app installable et reçoit les notifications.
// Volontairement minimal : aucune donnée n'est mise en cache (tout reste privé et à jour).
const OFFLINE = `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>PTZ Posting · hors ligne</title><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#020b2c;color:#eef0ff;font:16px system-ui;text-align:center;padding:1rem">
<div><p style="font-size:2rem;margin:0">📡</p><h1 style="font-size:1.2rem">Pas de connexion</h1><p>PTZ Posting a besoin d'Internet. Reviens quand le réseau est de retour.</p>
<button onclick="location.reload()" style="font:inherit;padding:.6rem 1.2rem;border-radius:999px;border:0;background:#023197;color:#fff">Réessayer</button></div></body></html>`;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

// Pages : réseau d'abord ; hors ligne, une page d'explication au lieu de l'erreur du navigateur.
self.addEventListener("fetch", (e) => {
  if (e.request.mode !== "navigate") return;
  e.respondWith(fetch(e.request).catch(() => new Response(OFFLINE, { headers: { "Content-Type": "text/html; charset=utf-8" } })));
});

self.addEventListener("push", (e) => {
  let m = {};
  try { m = e.data ? e.data.json() : {}; } catch { m = { body: e.data?.text() }; }
  e.waitUntil(self.registration.showNotification(m.title || "PTZ Posting", {
    body: m.body || "",
    icon: "/assets/icon-192.png",
    badge: "/assets/icon-192.png",
    tag: m.tag,
    data: { url: m.url || "/" },
  }));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || "/", self.location.origin).href;
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const w = wins.find((c) => c.url.startsWith(self.location.origin));
    if (w) { await w.focus(); return w.navigate(url); }
    return self.clients.openWindow(url);
  })());
});
