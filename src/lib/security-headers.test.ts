import { describe, expect, it } from "vitest";
import { ENFORCED_CSP, withSecurityHeaders } from "./security-headers";

describe("headers de segurança", () => {
  it("acrescenta os headers sem mudar status nem corpo", async () => {
    const r = withSecurityHeaders(new Response("<p>oi</p>", { status: 201, headers: { "content-type": "text/html" } }));
    expect(r.status).toBe(201);
    expect(await r.text()).toBe("<p>oi</p>");
    expect(r.headers.get("content-type")).toBe("text/html");
    expect(r.headers.get("x-content-type-options")).toBe("nosniff");
    expect(r.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
    expect(r.headers.get("strict-transport-security")).toContain("max-age=");
  });

  it("deixa o preview do Lovable abrir o app num iframe e bloqueia o resto", () => {
    expect(ENFORCED_CSP).toContain("frame-ancestors 'self' https://lovable.dev");
    // Qualquer pessoa publica app em *.lovable.app: ele não pode embutir o Mitikos.
    expect(ENFORCED_CSP).not.toContain("lovable.app");
    expect(withSecurityHeaders(new Response()).headers.get("x-frame-options")).toBeNull();
  });

  it("não sobrescreve um header que a rota já definiu", () => {
    const r = withSecurityHeaders(new Response(null, { headers: { "Referrer-Policy": "no-referrer" } }));
    expect(r.headers.get("referrer-policy")).toBe("no-referrer");
  });
});
