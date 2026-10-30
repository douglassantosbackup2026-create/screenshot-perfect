// Mescla de três vias para o estado salvo: quando este aparelho e outro (ou o WhatsApp) mudaram a
// mesma versão, junta as duas mudanças em vez de jogar fora a deste aparelho. Função pura.
//
// base   = a versão do banco de onde este aparelho partiu
// local  = o que este aparelho tem agora
// remote = o que está no banco agora
//
// Regra por campo: quem mudou ganha; se os dois mudaram, objetos são mesclados campo a campo e listas
// item a item (por id, ou pelo próprio conteúdo quando o item não tem id). Valores simples mudados
// dos dois lados ficam com o banco.

type Json = unknown;

const isPlainObject = (v: Json): v is Record<string, Json> => typeof v === "object" && v !== null && !Array.isArray(v);
const same = (a: Json, b: Json) => a === b || JSON.stringify(a) === JSON.stringify(b);

export type MergeResult<T> = {
  value: T;
  /** Campos (caminho) em que os dois lados mudaram o mesmo valor simples e o do banco ficou. */
  lost: string[];
};

export function merge3<T>(base: T, local: T, remote: T): MergeResult<T> {
  const lost: string[] = [];
  const value = mergeValue(base, local, remote, "", lost) as T;
  return { value, lost };
}

function mergeValue(base: Json, local: Json, remote: Json, path: string, lost: string[]): Json {
  if (same(local, base)) return remote;
  if (same(remote, base) || same(local, remote)) return local;
  if (isPlainObject(base) && isPlainObject(local) && isPlainObject(remote)) return mergeObject(base, local, remote, path, lost);
  if (Array.isArray(base) && Array.isArray(local) && Array.isArray(remote)) return mergeArray(base, local, remote, path, lost);
  lost.push(path || "(raiz)");
  return remote;
}

function mergeObject(base: Record<string, Json>, local: Record<string, Json>, remote: Record<string, Json>, path: string, lost: string[]) {
  const out: Record<string, Json> = {};
  const keys = new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(remote)]);
  for (const k of keys) {
    const inL = k in local;
    const inR = k in remote;
    const inB = k in base;
    // Apagado de um lado e intocado do outro: some.
    if (inB && !inL && same(remote[k], base[k])) continue;
    if (inB && !inR && same(local[k], base[k])) continue;
    if (!inL && !inR) continue;
    if (!inL) {
      out[k] = remote[k];
      continue;
    }
    if (!inR) {
      out[k] = local[k];
      continue;
    }
    out[k] = mergeValue(base[k], local[k], remote[k], path ? `${path}.${k}` : k, lost);
  }
  return out;
}

/** Chave de um item: o id, se tiver; senão o próprio conteúdo. */
function keyOf(item: Json): string {
  if (isPlainObject(item) && (typeof item["id"] === "string" || typeof item["id"] === "number")) return `id:${String(item["id"])}`;
  return `v:${JSON.stringify(item)}`;
}

function mergeArray(base: Json[], local: Json[], remote: Json[], path: string, lost: string[]) {
  const index = (xs: Json[]) => new Map(xs.map((x) => [keyOf(x), x] as const));
  const b = index(base);
  const l = index(local);
  const out: Json[] = [];
  for (const r of remote) {
    const k = keyOf(r);
    const inB = b.has(k);
    const inL = l.has(k);
    if (inB && !inL) {
      // Este aparelho apagou: só vale se o banco não mexeu no item.
      if (same(r, b.get(k))) continue;
      out.push(r);
      continue;
    }
    if (inL) out.push(inB ? mergeValue(b.get(k), l.get(k), r, `${path}[${k}]`, lost) : r);
    else out.push(r);
  }
  const inRemote = new Set(remote.map(keyOf));
  for (const x of local) {
    const k = keyOf(x);
    // Novo neste aparelho (não estava na base nem está no banco).
    if (!b.has(k) && !inRemote.has(k)) out.push(x);
  }
  return out;
}
