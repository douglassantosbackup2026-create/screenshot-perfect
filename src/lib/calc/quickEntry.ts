// Lançamento por frase: "gastei 62 na farmácia", "recebi 800 do freela", "comprei uma cadeira em 6x de 95".
// Função pura e determinística (sem IA). Ela só propõe: quem chama mostra o lançamento para a pessoa
// conferir antes de gravar, e o que faltou volta em `missing` para perguntar em vez de adivinhar.

import { normalize } from './categorize';
import { parseBRNumber } from './import';
import { addDays } from './recurring';
import { MAX_INSTALLMENTS } from './installments';

export type ParsedEntry = {
  amount: number | null; // centavos positivos; numa compra parcelada, o total
  kind: 'saida' | 'entrada';
  payee: string;
  date: string;          // "YYYY-MM-DD"
  installments: { count: number; total: number } | null;
  categoryHint: string | null; // id de uma categoria padrão (cat-…)
  missing: ('valor' | 'descricao')[];
}

const INCOME = /\b(recebi|ganhei|entrou|entraram|caiu|recebimento|vendi)\b/;

// Palavras que não são a descrição: verbos de lançar, artigos, preposições e datas soltas.
const STOP = new Set(
  (
    'gastei gasto paguei pago comprei compra lancei lanca lança anota anote anotei anotar coloquei botei recebi ganhei entrou entraram caiu vendi ' +
    'esqueci registra registrar foi foram era deu fiz tive teve hoje ontem anteontem agora ai aí ' +
    'o a os as um uma uns umas de do da dos das no na nos nas em com pro pra para pelo pela por e que meu minha meus minhas ' +
    'r$ reais real conto contos'
  ).split(' '),
);

const PAYMENT = /\b(?:no|na|pelo|pela|via|com|em)?\s*(?:cart[aã]o(?:\s+de\s+cr[eé]dito)?|d[eé]bito|cr[eé]dito|pix|dinheiro|boleto)(?:\s+(?:do|da|no|na)\s+[\p{L}\d]+)?/giu;
const PERIOD_WORDS = /\b(?:no|na|nesse|neste|essa|esta)?\s*(?:fim\s+de\s+semana|semana\s+passada|m[eê]s\s+passado)\b/giu;

// Palavra-chave → categoria padrão (as regras da pessoa têm prioridade na hora de gravar).
const HINTS: [RegExp, string][] = [
  [/\b(farmacia|drogaria|remedio|medico|consulta|exame|dentista|plano de saude)\b/, 'cat-saude'],
  [/\b(mercado|supermercado|feira|hortifruti|acougue|padaria)\b/, 'cat-mercado'],
  [/\b(uber|99|taxi|gasolina|combustivel|posto|estacionamento|onibus|metro|pedagio)\b/, 'cat-transporte'],
  [/\b(ifood|restaurante|almoco|jantar|lanche|cafe|pizza|bar)\b/, 'cat-restaurantes'],
  [/\b(aluguel|condominio|luz|energia|agua|gas|internet|iptu)\b/, 'cat-moradia'],
  [/\b(netflix|spotify|streaming|assinatura|prime|disney|youtube)\b/, 'cat-assinaturas'],
  [/\b(curso|escola|faculdade|livro|mensalidade)\b/, 'cat-educacao'],
  [/\b(das|mei|imposto|taxa|darf)\b/, 'cat-impostos'],
  [/\b(cinema|show|viagem|passeio|ingresso)\b/, 'cat-lazer'],
];
const INCOME_HINTS: [RegExp, string][] = [[/\b(salario|freela|cliente|pro labore|nota fiscal|servico)\b/, 'cat-renda']];

const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

function parseDate(text: string, today: string): { date: string; consumed: RegExp | null } {
  if (/\banteontem\b/.test(text)) return { date: addDays(today, -2), consumed: /\banteontem\b/ };
  if (/\bontem\b/.test(text)) return { date: addDays(today, -1), consumed: /\bontem\b/ };
  const m = /\bdia\s+(\d{1,2})\b/.exec(text);
  if (m) {
    const d = Number(m[1]);
    let y = Number(today.slice(0, 4));
    let mo = Number(today.slice(5, 7));
    if (d > Number(today.slice(8, 10))) {
      // "dia 28" quando hoje é 5: foi no mês passado.
      mo -= 1;
      if (mo === 0) {
        mo = 12;
        y -= 1;
      }
    }
    if (d >= 1 && d <= 31) {
      const day = Math.min(d, daysInMonth(y, mo));
      return { date: `${y}-${String(mo).padStart(2, '0')}-${String(day).padStart(2, '0')}`, consumed: /\bdia\s+\d{1,2}\b/ };
    }
  }
  return { date: today, consumed: null };
}

const MONEY = /(?:r\$\s*)?\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|(?:r\$\s*)?\d+(?:,\d{1,2})?/i;

export function parseEntry(raw: string, today: string): ParsedEntry {
  let text = ` ${raw.trim()} `;
  const lower = normalize(text);
  const kind: ParsedEntry['kind'] = INCOME.test(lower) ? 'entrada' : 'saida';

  // Data ("ontem", "dia 12") e trechos que não são descrição saem antes de procurar o valor.
  const when = parseDate(normalize(text), today);
  if (when.consumed) text = text.replace(new RegExp(when.consumed.source, 'i'), ' ');
  text = text.replace(PAYMENT, ' ').replace(PERIOD_WORDS, ' ');

  // Parcelado: "6x de 95" (valor de cada parcela) ou "em 10x" (o valor da frase é o total).
  let installments: ParsedEntry['installments'] = null;
  let perInstallment: number | null = null;
  let count: number | null = null;
  const inst = /(\d{1,2})\s*x(?:\s*(?:de\s*)?((?:r\$\s*)?[\d.,]+))?/i.exec(text);
  if (inst) {
    count = Number(inst[1]);
    perInstallment = inst[2] ? parseBRNumber(inst[2]) : null;
    text = text.replace(inst[0], ' ');
  }

  let amount: number | null = null;
  const money = MONEY.exec(text);
  if (money) {
    amount = parseBRNumber(money[0]);
    text = text.replace(money[0], ' ');
  }
  if (count !== null && count >= 2 && count <= MAX_INSTALLMENTS) {
    const total = perInstallment !== null ? perInstallment * count : amount;
    if (total && total > 0) {
      installments = { count, total };
      amount = total;
    }
  }
  if (amount !== null && amount <= 0) amount = null;

  // Descrição: a primeira parte da frase que sobra com palavras de verdade (até 4 palavras).
  const clauses = text.split(/[,;.!?\n]+/);
  let payee = '';
  for (const c of clauses) {
    const words = c
      .split(/\s+/)
      .filter((w) => w && !STOP.has(normalize(w)) && !/^\d+([.,]\d+)?$/.test(w));
    if (words.length) {
      payee = words.slice(0, 4).join(' ');
      break;
    }
  }
  payee = payee.replace(/^[^\p{L}\d]+|[^\p{L}\d]+$/gu, '');
  if (payee) payee = payee[0]!.toUpperCase() + payee.slice(1);

  const hints = kind === 'entrada' ? INCOME_HINTS : HINTS;
  const categoryHint = hints.find(([re]) => re.test(lower))?.[1] ?? null;

  const missing: ParsedEntry['missing'] = [];
  if (amount === null) missing.push('valor');
  if (!payee) missing.push('descricao');
  return { amount, kind, payee, date: when.date, installments, categoryHint, missing };
}
