import { createFileRoute } from "@tanstack/react-router";

import { SITE_URL } from "@/lib/site";

/** Réponse commune à GET et HEAD : HEAD renvoie les mêmes en-têtes sans corps. */
function robotsResponse(withBody: boolean): Response {
  const lines = ["User-agent: *", "Allow: /", "Disallow: /auth/"];
  // La ligne Sitemap exige une URL absolue : elle n'apparaît qu'une fois le domaine défini.
  if (SITE_URL) lines.push("", `Sitemap: ${SITE_URL}/sitemap.xml`);
  return new Response(withBody ? `${lines.join("\n")}\n` : null, {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
}

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: () => robotsResponse(true),
      HEAD: () => robotsResponse(false),
    },
  },
});
