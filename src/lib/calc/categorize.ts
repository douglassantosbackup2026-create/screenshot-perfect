// Regras de categorização: "quando o favorecido contém X, use a categoria Y". Funções puras.
// A regra mais específica vence: "igual a" antes de "contém"; entre "contém", o texto mais longo.

export type RuleOp = 'contem' | 'igual';

export interface CategoryRule {
  id: string;
  op: RuleOp;
  value: string;          // texto procurado no favorecido
  categoryId: string;
  renameTo: string | null; // opcional: troca o favorecido por um nome mais limpo
}

/** Minúsculas, sem acentos e com espaços simples, para comparar textos de extrato. */
export function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function ruleMatches(rule: CategoryRule, payee: string): boolean {
  const p = normalize(payee);
  const v = normalize(rule.value);
  if (!v) return false;
  return rule.op === 'igual' ? p === v : p.includes(v);
}

const specificity = (r: CategoryRule) => (r.op === 'igual' ? 1e6 : 0) + normalize(r.value).length;

/** A regra que vale para o favorecido, ou null. */
export function findRule(rules: CategoryRule[], payee: string): CategoryRule | null {
  let best: CategoryRule | null = null;
  for (const r of rules) if (ruleMatches(r, payee) && (!best || specificity(r) > specificity(best))) best = r;
  return best;
}

/** Aplica as regras a um lançamento sem categoria. Quem já tem categoria fica como está. */
export function applyRules<T extends { payee: string; categoryId: string | null }>(rules: CategoryRule[], tx: T): T {
  if (tx.categoryId) return tx;
  const r = findRule(rules, tx.payee);
  return r ? { ...tx, categoryId: r.categoryId, payee: r.renameTo ?? tx.payee } : tx;
}
