import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn(() => Promise.resolve({ data: null, error: null }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));

const { getConsent, parseUtm, readConsent, setConsent, track, POLICY_VERSION, captureUtm, currentUtm } = await import("./analytics");
const { buildFunnel, funnelSources } = await import("./funnel");

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  rpc.mockClear();
});

describe("consentimento", () => {
  it("sem escolha, nada é enviado e nenhum id é criado", () => {
    track("landing_view");
    expect(rpc).not.toHaveBeenCalled();
    expect(window.localStorage.getItem("mk_anon")).toBeNull();
  });

  it("recusado: registra a recusa sem id e não envia eventos", async () => {
    await setConsent("recusado");
    expect(rpc).toHaveBeenCalledWith("record_consent", { p_anon: null, p_choice: "recusado", p_version: POLICY_VERSION });
    rpc.mockClear();
    track("landing_view");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("aceito: cria o id, registra e envia eventos com as UTMs da visita", async () => {
    captureUtm("?utm_source=instagram&utm_campaign=lancamento&x=1");
    captureUtm("?outra=coisa");
    await setConsent("aceito");
    expect(getConsent()).toBe("aceito");
    const anon = window.localStorage.getItem("mk_anon");
    expect(anon).toBeTruthy();
    track("calculator_used", { comInss: true });
    expect(rpc).toHaveBeenLastCalledWith("track_event", expect.objectContaining({ p_anon: anon, p_name: "calculator_used", p_utm: { source: "instagram", campaign: "lancamento" }, p_props: { comInss: true } }));
    expect(currentUtm()).toEqual({ source: "instagram", campaign: "lancamento" });
  });

  it("escolha de outra versão da política conta como não escolhida", () => {
    expect(readConsent(JSON.stringify({ choice: "aceito", version: "velha" }))).toBeNull();
    expect(readConsent("lixo")).toBeNull();
    expect(readConsent(JSON.stringify({ choice: "aceito", version: POLICY_VERSION }))).toBe("aceito");
  });

  it("UTMs: só as três do funil, cortadas em 100", () => {
    expect(parseUtm(`?utm_source=${"a".repeat(150)}&utm_term=x`)).toEqual({ source: "a".repeat(100) });
  });
});

describe("funil", () => {
  const rows = [
    { step: "landing_view", source: "(direto)", people: 80 },
    { step: "landing_view", source: "instagram", people: 20 },
    { step: "calculator_used", source: "instagram", people: 10 },
    { step: "calculator_used", source: "(direto)", people: 30 },
    { step: "signup_completed", source: "instagram", people: 5 },
  ];
  it("soma as origens e calcula as conversões", () => {
    const f = buildFunnel(rows);
    expect(f.map((s) => s.people)).toEqual([100, 40, 0, 5, 0, 0]);
    expect(f[1]!.fromPrevious).toBe(0.4);
    expect(f[3]!.fromPrevious).toBeNull();
    expect(f[3]!.fromFirst).toBe(0.05);
  });
  it("filtra por origem e ordena as origens", () => {
    expect(buildFunnel(rows, "instagram").map((s) => s.people)).toEqual([20, 10, 0, 5, 0, 0]);
    expect(funnelSources(rows).map((s) => s.source)).toEqual(["(direto)", "instagram"]);
  });
});
