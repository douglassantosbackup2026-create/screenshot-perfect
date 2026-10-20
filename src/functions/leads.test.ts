import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({ validator: () => ({ handler: (h: unknown) => h }) }),
}));
vi.mock("@tanstack/react-start/server", () => ({ getRequest: () => new Request("https://app.exemplo.com/") }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

const { calculatorLink, resultEmail, validateLead } = await import("./leads");
const { simulate } = await import("@/lib/calc/retirement");
const { formatMonthly } = await import("@/lib/calc/format");
const { inputsOf } = await import("./leads");

const sim = { currentAge: 30, retirementAge: 60, desiredIncome: 8000, initialWealth: 50000, monthlyContribution: 1500, inssEstimate: null };

describe("leads", () => {
  it("valida e-mail e limpa a simulação", () => {
    expect(() => validateLead({ email: "nada" })).toThrow();
    const v = validateLead({ email: "  Ana@Exemplo.com ", simulation: { ...sim, currentAge: 300 }, utm: { source: "instagram", medium: 5 } });
    expect(v.email).toBe("ana@exemplo.com");
    expect(v.simulation).toBeNull();
    expect(v.utm).toEqual({ source: "instagram", medium: null, campaign: null });
    expect(validateLead({ email: "a@b.co", simulation: sim }).simulation).toEqual(sim);
  });

  it("o link reabre a calculadora com os mesmos números", () => {
    expect(calculatorLink("https://app.exemplo.com/", sim)).toBe(
      "https://app.exemplo.com/calculadora?idade=30&aposentar=60&renda=8000&patrimonio=50000&aporte=1500",
    );
  });

  it("o e-mail traz o aporte calculado no servidor e o link", () => {
    const r = simulate(inputsOf(sim), "central", false);
    const msg = resultEmail(sim, "https://x/calculadora");
    expect(msg.subject).toContain(formatMonthly(r.requiredMonthlyContribution));
    expect(msg.html).toContain(formatMonthly(r.requiredMonthlyContribution));
    expect(msg.html).toContain('href="https://x/calculadora"');
    expect(msg.text).toContain("https://x/calculadora");
  });
});
