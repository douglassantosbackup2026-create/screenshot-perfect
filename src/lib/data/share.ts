// Compartilhamento estrutural depois de uma ação: o que saiu igual volta a ser o mesmo objeto de antes.
// As ações trabalham numa cópia completa (structuredClone) e devolvem tudo novo; aqui a identidade do que
// não mudou é restaurada, para que cache por fatia, seletores e React.memo enxerguem só o que mudou.
// Só lida com dados de JSON (objetos simples, listas, texto, número, booleano, null), que é o que o estado guarda.

type Plain = Record<string, unknown>;
const isPlain = (v: unknown): v is Plain => typeof v === "object" && v !== null && !Array.isArray(v);
const idOf = (v: unknown): unknown => (isPlain(v) ? v["id"] : undefined);

/**
 * Devolve `next` com o máximo possível de `prev` reaproveitado. Se tudo for igual, devolve o próprio `prev`.
 * Em listas de objetos com `id`, casa os itens pelo id (um lançamento editado não muda a identidade dos outros,
 * mesmo que a ordem mude); nas demais, pela posição.
 */
export function share<T>(prev: T, next: T): T {
  if (Object.is(prev, next)) return prev;
  if (Array.isArray(prev) && Array.isArray(next)) return shareArray(prev, next) as T;
  if (isPlain(prev) && isPlain(next)) return shareObject(prev, next) as T;
  return next;
}

function shareArray(prev: unknown[], next: unknown[]): unknown[] {
  const byId = new Map<unknown, unknown>();
  for (const p of prev) {
    const id = idOf(p);
    if (id !== undefined) byId.set(id, p);
  }
  let same = prev.length === next.length;
  const out = next.map((n, i) => {
    const id = idOf(n);
    const match = id !== undefined && byId.has(id) ? byId.get(id) : prev[i];
    const v = match === undefined ? n : share(match, n);
    if (v !== prev[i]) same = false;
    return v;
  });
  return same ? prev : out;
}

function shareObject(prev: Plain, next: Plain): Plain {
  const keys = Object.keys(next);
  let same = keys.length === Object.keys(prev).length;
  const out: Plain = {};
  for (const k of keys) {
    const v = k in prev ? share(prev[k], next[k]) : next[k];
    if (v !== prev[k] || !(k in prev)) same = false;
    out[k] = v;
  }
  return same ? prev : out;
}

/**
 * Para o estado inteiro: compartilha cada fatia, mas a raiz é sempre um objeto novo
 * (quem compara a raiz, como a gravação no banco, continua vendo uma versão nova a cada commit).
 */
export function shareState<T extends object>(prev: T | null, next: T): T {
  if (!prev) return next;
  const shared = share(prev, next);
  return shared === prev ? ({ ...prev } as T) : shared;
}

/** Congela em profundidade (só em desenvolvimento e testes): escrita no estado vivo vira erro, não corrupção. */
export function deepFreeze<T>(v: T): T {
  if (typeof v !== "object" || v === null || Object.isFrozen(v)) return v;
  Object.freeze(v);
  for (const child of Object.values(v as object)) deepFreeze(child);
  return v;
}
