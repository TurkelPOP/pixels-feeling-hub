import { createFileRoute } from "@tanstack/react-router";

import { episodePath } from "@/lib/episodes";
import { getPodcastFeed } from "@/lib/podcast.functions";
import { SITE_URL } from "@/lib/site";

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function isoDate(raw: string): string | undefined {
  const d = new Date(raw);
  return raw && !isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : undefined;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        // Un sitemap exige des URLs absolues : sans VITE_SITE_URL il n'y a rien de valide à publier.
        if (!SITE_URL) return new Response("Not found", { status: 404 });

        const urls: Array<{ loc: string; lastmod?: string }> = [{ loc: `${SITE_URL}/` }];
        try {
          const feed = await getPodcastFeed();
          for (const ep of feed.episodes) {
            urls.push({ loc: `${SITE_URL}${episodePath(ep)}`, lastmod: isoDate(ep.pubDate) });
          }
        } catch (error) {
          // Flux indisponible : on publie au moins l'accueil plutôt qu'une erreur pour les robots.
          console.error("[sitemap] feed unavailable", error);
        }

        const body = urls
          .map(
            (u) =>
              `  <url><loc>${escapeXml(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}</url>`,
          )
          .join("\n");
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
        return new Response(xml, {
          headers: {
            "content-type": "application/xml; charset=utf-8",
            "cache-control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
