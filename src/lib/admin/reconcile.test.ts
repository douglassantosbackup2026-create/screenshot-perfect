import { describe, expect, it } from "vitest";
import { reconcile } from "./reconcile";

describe("conciliação com o Mercado Pago", () => {
  it("o que bate não aparece", () => {
    expect(reconcile([{ id: "mp_1", status: "approved", cents: 3990, email: null }], [{ id: "mp_1", status: "approved", cents: 3990, credited: true }])).toEqual([]);
  });

  it("aprovado lá e não creditado aqui", () => {
    const r = reconcile([{ id: "mp_2", status: "approved", cents: 3990, email: "a@b.c" }], []);
    expect(r).toMatchObject([{ id: "mp_2", kind: "aprovado_sem_credito" }]);
  });

  it("valor diferente e status diferente", () => {
    const r = reconcile(
      [
        { id: "mp_3", status: "approved", cents: 3990, email: null },
        { id: "mp_4", status: "refunded", cents: 3990, email: null },
      ],
      [
        { id: "mp_3", status: "approved", cents: 3192, credited: true },
        { id: "mp_4", status: "approved", cents: 3990, credited: true },
      ],
    );
    expect(r.map((i) => i.kind)).toEqual(["valor_diferente", "status_diferente"]);
  });

  it("creditado no app e ausente no Mercado Pago", () => {
    expect(reconcile([], [{ id: "mp_5", status: "approved", cents: 3990, credited: true }])).toMatchObject([{ kind: "so_no_app" }]);
    // Recusado que só existe no app não é problema de crédito.
    expect(reconcile([], [{ id: "mp_6", status: "rejected", cents: 3990, credited: false }])).toEqual([]);
  });
});
