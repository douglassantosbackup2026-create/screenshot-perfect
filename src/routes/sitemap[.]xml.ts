import { createFileRoute } from "@tanstack/react-router";

/** Páginas públicas que os buscadores devem conhecer (as do app ficam fora, veja public/robots.txt). */
export const PUBLIC_PAGES = ["/", "/calculadora", "/cadastro", "/entrar", "/sobre", "/termos", "/privacidade"];

export function sitemapXml(origin: string, today: string) {
  const base = origin.replace(/\/+$/, "");
  const urls = PUBLIC_PAGES.map(
    (p) => `  <url><loc>${base}${p}</loc><lastmod>${today}</lastmod><changefreq>${p === "/" ? "weekly" : "monthly"}</changefreq></url>`,
  ).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

// Gerado no servidor com o domínio de quem pediu, para valer no preview, no domínio publicado e no próprio.
export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: ({ request }) => {
        const url = new URL(request.url);
        const origin = process.env["PUBLIC_SITE_URL"] ?? `${url.protocol}//${url.host}`;
        return new Response(sitemapXml(origin, new Date().toISOString().slice(0, 10)), {
          headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});
