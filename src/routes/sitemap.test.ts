import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({ createFileRoute: () => () => ({}) }));
const { sitemapXml, PUBLIC_PAGES } = await import("./sitemap[.]xml");

describe("sitemap", () => {
  it("lista só as páginas públicas, com o domínio de quem pediu", () => {
    const xml = sitemapXml("https://app.exemplo.com/", "2026-10-20");
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml.match(/<loc>/g)).toHaveLength(PUBLIC_PAGES.length);
    expect(xml).toContain("<loc>https://app.exemplo.com/calculadora</loc>");
    expect(xml).not.toContain("/hoje");
  });
});
