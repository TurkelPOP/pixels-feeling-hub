import { createFileRoute } from "@tanstack/react-router";

import { SITE_URL } from "@/lib/site";

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: () => {
        const lines = ["User-agent: *", "Allow: /", "Disallow: /auth/"];
        // La ligne Sitemap exige une URL absolue : elle n'apparaît qu'une fois le domaine défini.
        if (SITE_URL) lines.push("", `Sitemap: ${SITE_URL}/sitemap.xml`);
        return new Response(`${lines.join("\n")}\n`, {
          headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" },
        });
      },
    },
  },
});
