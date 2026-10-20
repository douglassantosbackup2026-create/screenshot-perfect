// Importação de extratos (OFX e CSV) e detecção de duplicados. Funções puras.
// Valores em centavos, com sinal: entrada positiva, saída negativa.

import { normalize } from './categorize';

export interface ImportedTx {
  importedId: string | null; // FITID do OFX ou identificador do CSV
  date: string;              // "YYYY-MM-DD"
  amount: number;            // centavos
  payee: string;
  memo: string | null;
}

/** Lê "1.234,56", "-1234.56", "R$ 1.234,56" ou "(123,45)". O separador decimal é o último, se tiver 1 ou 2 dígitos depois. */
export function parseBRNumber(raw: string): number | null {
  let s = raw.replace(/R\$|\s/g, '');
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (s.startsWith('-')) {
    negative = !negative;
    s = s.slice(1);
  } else if (s.startsWith('+')) s = s.slice(1);
  if (!/^[\d.,]+$/.test(s)) return null;
  const m = /[.,](\d{1,2})$/.exec(s);
  const int = (m ? s.slice(0, m.index) : s).replace(/[.,]/g, '');
  const cents = Number(int || '0') * 100 + (m ? Number(m[1]!.padEnd(2, '0')) : 0);
  if (!Number.isFinite(cents)) return null;
  return negative ? -cents : cents;
}

/** "31/12/2026", "31/12/26", "2026-12-31" ou "20261231..." → "2026-12-31". */
export function parseDate(raw: string): string | null {
  const s = raw.trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(s);
  if (m) {
    const y = m[3]!.length === 2 ? `20${m[3]}` : m[3]!;
    return `${y}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}`;
  }
  m = /^(\d{4})(\d{2})(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

const ofxTag = (block: string, tag: string) => {
  const m = new RegExp(`<${tag}>([^<\\r\\n]*)`, 'i').exec(block);
  return m ? m[1]!.trim() : null;
};

/** Lê as transações de um OFX (SGML ou XML), o formato que os bancos brasileiros exportam. */
export function parseOFX(text: string): ImportedTx[] {
  const out: ImportedTx[] = [];
  for (const block of text.split(/<STMTTRN>/i).slice(1)) {
    const date = parseDate(ofxTag(block, 'DTPOSTED') ?? '');
    const amount = parseBRNumber(ofxTag(block, 'TRNAMT') ?? '');
    if (!date || amount === null) continue;
    const name = ofxTag(block, 'NAME');
    const memo = ofxTag(block, 'MEMO');
    out.push({
      importedId: ofxTag(block, 'FITID') || null,
      date,
      amount,
      payee: name || memo || 'Sem descrição',
      memo: name && memo && memo !== name ? memo : null,
    });
  }
  return out;
}

/** Divide uma linha de CSV respeitando aspas. */
function splitCsvLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (c === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === sep && !quoted) {
      out.push(cur);
      cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out.map((v) => v.trim());
}

// Nomes de coluna em ordem de preferência: "Descrição" vence "Histórico" (Inter traz os dois), e "Saldo" nunca é o valor.
const HEADERS = {
  date: ['data', 'date', 'dt'],
  payee: ['descricao', 'title', 'titulo', 'estabelecimento', 'lancamento', 'historico', 'description', 'favorecido'],
  amount: ['valor', 'amount', 'quantia', 'value'],
  id: ['identificador', 'fitid', 'id'],
};
const findCol = (header: string[], names: string[]) => {
  const h = header.map(normalize);
  for (const n of names) {
    const i = h.findIndex((x) => x.startsWith(n));
    if (i >= 0) return i;
  }
  return -1;
};

export type BankId = 'nubank_cartao' | 'nubank_conta' | 'inter' | 'itau';
/** Bancos com modelo de CSV conhecido. Fatura de cartão traz compras como valores positivos: o sinal é invertido. */
export const BANKS: Record<BankId, { label: string; invert: boolean; matches: (h: string[]) => boolean }> = {
  nubank_cartao: { label: 'Nubank (cartão)', invert: true, matches: (h) => h.includes('date') && h.includes('title') && h.includes('amount') },
  nubank_conta: { label: 'Nubank (conta)', invert: false, matches: (h) => h.includes('data') && h.includes('valor') && h.includes('identificador') },
  inter: { label: 'Inter', invert: false, matches: (h) => h.includes('data lancamento') && h.some((x) => x.startsWith('historico')) },
  itau: { label: 'Itaú', invert: false, matches: (h) => h.some((x) => x.startsWith('lancamento')) && h.some((x) => x.startsWith('ag./origem') || x.startsWith('valor (r$)')) },
};

export interface CsvResult {
  rows: ImportedTx[];
  skipped: number;       // linhas que não deu para ler
  bank: BankId | null;   // modelo reconhecido pelo cabeçalho
}

/** Separador mais provável da linha (ponto e vírgula, tabulação ou vírgula). */
const separatorOf = (line: string) => [';', '\t', ','].sort((a, b) => line.split(b).length - line.split(a).length)[0]!;

/**
 * Lê um CSV com cabeçalho (colunas de data, descrição e valor; identificador opcional).
 * O cabeçalho é a primeira linha que tem data e valor: extratos como o do Inter trazem um resumo antes.
 * `invert` troca o sinal; sem informar, segue o banco reconhecido (fatura do Nubank inverte).
 */
export function parseCSV(text: string, invert?: boolean): CsvResult {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  const at = lines.findIndex((l) => {
    const h = splitCsvLine(l, separatorOf(l));
    return findCol(h, HEADERS.date) >= 0 && findCol(h, HEADERS.amount) >= 0;
  });
  if (at < 0 || at === lines.length - 1) return { rows: [], skipped: Math.max(lines.length - 1, 0), bank: null };
  const sep = separatorOf(lines[at]!);
  const header = splitCsvLine(lines[at]!, sep);
  const normalized = header.map(normalize);
  const bank = (Object.keys(BANKS) as BankId[]).find((k) => BANKS[k].matches(normalized)) ?? null;
  const flip = invert ?? (bank ? BANKS[bank].invert : false);
  const col = { date: findCol(header, HEADERS.date), payee: findCol(header, HEADERS.payee), amount: findCol(header, HEADERS.amount), id: findCol(header, HEADERS.id) };
  const rows: ImportedTx[] = [];
  let skipped = 0;
  for (const line of lines.slice(at + 1)) {
    const f = splitCsvLine(line, sep);
    const date = parseDate(f[col.date] ?? '');
    const amount = parseBRNumber(f[col.amount] ?? '');
    if (!date || amount === null) {
      skipped++;
      continue;
    }
    rows.push({
      importedId: col.id >= 0 ? f[col.id] || null : null,
      date,
      amount: flip ? -amount : amount,
      payee: (col.payee >= 0 ? f[col.payee] : '') || 'Sem descrição',
      memo: null,
    });
  }
  return { rows, skipped, bank };
}

export interface ExistingTx {
  id: string;
  date: string;
  amount: number;
  payee: string;
  importedId: string | null;
  imported: boolean; // veio de uma importação anterior
}

export interface DedupeResult {
  fresh: ImportedTx[];                                 // novos: entram como lançamentos
  matched: { existingId: string; tx: ImportedTx }[];   // casam com um lançamento manual: ficam vinculados a ele
  duplicates: ImportedTx[];                            // já estavam importados: ficam de fora
}

const dayDiff = (a: string, b: string) => Math.abs(Date.parse(a + 'T00:00:00Z') - Date.parse(b + 'T00:00:00Z')) / 86400000;
const MATCH_WINDOW_DAYS = 3;

/**
 * Separa o extrato em novos, vinculados a lançamentos manuais e duplicados.
 * 1. Mesmo identificador de uma importação anterior: duplicado.
 * 2. Mesmo valor, até 3 dias de diferença, contra um lançamento manual: vinculado (o manual fica, com a categoria da pessoa).
 * 3. Sem identificador, mesmo dia, valor e favorecido de uma importação anterior: duplicado (o mesmo CSV de novo).
 * Cada lançamento existente casa com uma linha só, então duas compras iguais no mesmo dia continuam sendo duas.
 */
export function dedupe(incoming: ImportedTx[], existing: ExistingTx[]): DedupeResult {
  const used = new Set<string>();
  const ids = new Set(existing.flatMap((e) => (e.importedId ? [e.importedId] : [])));
  const r: DedupeResult = { fresh: [], matched: [], duplicates: [] };
  for (const tx of incoming) {
    if (tx.importedId && ids.has(tx.importedId)) {
      r.duplicates.push(tx);
      continue;
    }
    const manual = existing
      .filter((e) => !used.has(e.id) && !e.imported && e.amount === tx.amount && dayDiff(e.date, tx.date) <= MATCH_WINDOW_DAYS)
      .sort((a, b) => dayDiff(a.date, tx.date) - dayDiff(b.date, tx.date))[0];
    if (manual) {
      used.add(manual.id);
      r.matched.push({ existingId: manual.id, tx });
      continue;
    }
    const again =
      !tx.importedId &&
      existing.find((e) => !used.has(e.id) && e.imported && e.amount === tx.amount && e.date === tx.date && normalize(e.payee) === normalize(tx.payee));
    if (again) {
      used.add(again.id);
      r.duplicates.push(tx);
      continue;
    }
    r.fresh.push(tx);
  }
  return r;
}
