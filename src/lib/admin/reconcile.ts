// Conciliação com o Mercado Pago: compara o que o MP diz que foi pago com o que o app registrou.
// Função pura; a busca no MP e no banco fica em panel.functions.ts.

export type MpRow = { id: string; status: string; cents: number; email: string | null };
export type LocalRow = { id: string; status: string; cents: number; credited: boolean };

export type ReconcileIssue = {
  id: string;
  kind: "aprovado_sem_credito" | "valor_diferente" | "status_diferente" | "so_no_app";
  detail: string;
  mpCents: number | null;
  appCents: number | null;
};

const money = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Só o que não bate. Pagamentos que batem não aparecem. */
export function reconcile(mp: MpRow[], local: LocalRow[]): ReconcileIssue[] {
  const byId = new Map(local.map((l) => [l.id, l]));
  const seen = new Set<string>();
  const issues: ReconcileIssue[] = [];
  for (const m of mp) {
    const l = byId.get(m.id);
    seen.add(m.id);
    if (m.status === "approved" && !l?.credited) {
      issues.push({ id: m.id, kind: "aprovado_sem_credito", detail: `Aprovado no Mercado Pago (${money(m.cents)}) e sem acesso liberado no app.`, mpCents: m.cents, appCents: l?.cents ?? null });
    } else if (l && l.cents !== m.cents) {
      issues.push({ id: m.id, kind: "valor_diferente", detail: `Mercado Pago ${money(m.cents)} × app ${money(l.cents)}.`, mpCents: m.cents, appCents: l.cents });
    } else if (l && l.status !== m.status) {
      issues.push({ id: m.id, kind: "status_diferente", detail: `Status no Mercado Pago "${m.status}" × app "${l.status}".`, mpCents: m.cents, appCents: l.cents });
    }
  }
  for (const l of local)
    if (!seen.has(l.id) && l.credited)
      issues.push({ id: l.id, kind: "so_no_app", detail: "Creditado no app e não encontrado no Mercado Pago no período.", mpCents: null, appCents: l.cents });
  return issues;
}
