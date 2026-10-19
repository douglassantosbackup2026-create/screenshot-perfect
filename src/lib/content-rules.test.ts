import { describe, it, expect } from "vitest";
import { publishBlockers } from "./content-rules";

describe("publicação de lição", () => {
  it("bloqueia sem revisor, data e fonte", () => {
    expect(publishBlockers({ reviewedBy: "", reviewedAt: null, sources: [] })).toHaveLength(3);
  });
  it("libera com os três preenchidos", () => {
    expect(publishBlockers({ reviewedBy: "Maria CFP", reviewedAt: "2026-10-01", sources: [{ label: "Lei", url: "https://x" }] })).toEqual([]);
  });
});
