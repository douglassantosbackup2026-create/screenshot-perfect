import { describe, it, expect } from 'vitest';
import { dedupe, parseBRNumber, parseCSV, parseDate, parseOFX, type ExistingTx, type ImportedTx } from './import';

const OFX_SGML = `OFXHEADER:100
DATA:OFXSGML
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20261003120000[-3:BRT]
<TRNAMT>-450.90
<FITID>202610030001
<MEMO>COMPRA CARTAO - PAO DE ACUCAR
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20261001
<TRNAMT>8000,00
<FITID>202610010001
<NAME>PIX RECEBIDO CLIENTE X
<MEMO>NF 123
</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;

describe('números e datas de extrato', () => {
  it('lê formatos brasileiros e americanos', () => {
    expect(parseBRNumber('1.234,56')).toBe(123456);
    expect(parseBRNumber('-1234.5')).toBe(-123450);
    expect(parseBRNumber('R$ 10')).toBe(1000);
    expect(parseBRNumber('(12,30)')).toBe(-1230);
    expect(parseBRNumber('1,234.56')).toBe(123456);
    expect(parseBRNumber('1.234')).toBe(123400);
    expect(parseBRNumber('abc')).toBeNull();
  });

  it('lê datas', () => {
    expect(parseDate('03/10/2026')).toBe('2026-10-03');
    expect(parseDate('3/1/26')).toBe('2026-01-03');
    expect(parseDate('2026-10-03')).toBe('2026-10-03');
    expect(parseDate('20261003120000[-3:BRT]')).toBe('2026-10-03');
    expect(parseDate('ontem')).toBeNull();
  });
});

describe('OFX', () => {
  it('lê transações do SGML, com MEMO quando não há NAME', () => {
    expect(parseOFX(OFX_SGML)).toEqual([
      { importedId: '202610030001', date: '2026-10-03', amount: -45090, payee: 'COMPRA CARTAO - PAO DE ACUCAR', memo: null },
      { importedId: '202610010001', date: '2026-10-01', amount: 800000, payee: 'PIX RECEBIDO CLIENTE X', memo: 'NF 123' },
    ]);
  });
});

describe('CSV', () => {
  it('extrato de conta com ponto e vírgula e identificador', () => {
    const csv = 'Data;Descrição;Valor;Identificador\n03/10/2026;"Mercado; centro";-450,90;abc\n01/10/2026;Salário;8.000,00;def\nlinha ruim;x;y;z';
    const r = parseCSV(csv);
    expect(r.skipped).toBe(1);
    expect(r.rows).toEqual([
      { importedId: 'abc', date: '2026-10-03', amount: -45090, payee: 'Mercado; centro', memo: null },
      { importedId: 'def', date: '2026-10-01', amount: 800000, payee: 'Salário', memo: null },
    ]);
  });

  it('fatura de cartão com valores positivos e sinal invertido', () => {
    const r = parseCSV('date,title,amount\n2026-10-03,Uber *Trip,23.90', true);
    expect(r.rows[0]).toMatchObject({ date: '2026-10-03', payee: 'Uber *Trip', amount: -2390, importedId: null });
  });

  it('sem colunas de data e valor, não lê nada', () => {
    expect(parseCSV('a,b\n1,2')).toEqual({ rows: [], skipped: 1 });
  });
});

describe('duplicados', () => {
  const imp = (amount: number, date: string, payee = 'X', importedId: string | null = null): ImportedTx => ({ importedId, date, amount, payee, memo: null });
  const ex = (id: string, amount: number, date: string, imported: boolean, importedId: string | null = null, payee = 'X'): ExistingTx => ({
    id, amount, date, imported, importedId, payee,
  });

  it('mesmo identificador fica de fora', () => {
    const r = dedupe([imp(-100, '2026-10-03', 'X', 'F1')], [ex('a', -100, '2026-10-03', true, 'F1')]);
    expect(r.duplicates).toHaveLength(1);
    expect(r.fresh).toHaveLength(0);
  });

  it('casa com o lançamento manual mais próximo em até 3 dias', () => {
    const r = dedupe(
      [imp(-100, '2026-10-05', 'X', 'F2')],
      [ex('longe', -100, '2026-10-01', false), ex('perto', -100, '2026-10-04', false), ex('outro-valor', -101, '2026-10-05', false)],
    );
    expect(r.matched).toEqual([{ existingId: 'perto', tx: imp(-100, '2026-10-05', 'X', 'F2') }]);
  });

  it('o mesmo CSV duas vezes não duplica, mas duas compras iguais no mesmo dia continuam duas', () => {
    const existing = [ex('a', -500, '2026-10-03', true, null, 'Café')];
    const r = dedupe([imp(-500, '2026-10-03', 'Café'), imp(-500, '2026-10-03', 'Café')], existing);
    expect(r.duplicates).toHaveLength(1);
    expect(r.fresh).toHaveLength(1);
  });
});
