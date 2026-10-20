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
    expect(parseCSV('a,b\n1,2')).toEqual({ rows: [], skipped: 1, bank: null });
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

describe('modelos de CSV dos bancos', () => {
  it('Nubank cartão: reconhece e inverte o sinal sozinho', () => {
    const r = parseCSV('date,title,amount\n2026-10-03,Uber *Trip,23.90\n2026-10-04,Pagamento recebido,-500.00');
    expect(r.bank).toBe('nubank_cartao');
    expect(r.rows.map((x) => x.amount)).toEqual([-2390, 50000]);
  });

  it('Nubank conta: identificador vira o id do banco', () => {
    const r = parseCSV('Data,Valor,Identificador,Descrição\n03/10/2026,-45.90,6510-aa,Compra no débito - Padaria\n05/10/2026,8000.00,6511-bb,Transferência recebida');
    expect(r.bank).toBe('nubank_conta');
    expect(r.rows[0]).toEqual({ importedId: '6510-aa', date: '2026-10-03', amount: -4590, payee: 'Compra no débito - Padaria', memo: null });
  });

  it('Inter: pula o resumo do topo, usa a Descrição e nunca o Saldo', () => {
    const csv = [
      'Extrato Conta Corrente',
      'Conta ;12345678',
      'Período ;01/10/2026 a 20/10/2026',
      'Saldo ;1.234,56',
      '',
      'Data Lançamento;Histórico;Descrição;Valor;Saldo',
      '03/10/2026;Pix enviado;Maria Silva;-150,00;1.084,56',
      '05/10/2026;Pix recebido;Cliente Alfa;8.000,00;9.084,56',
    ].join('\n');
    const r = parseCSV(csv);
    expect(r.bank).toBe('inter');
    expect(r.rows).toEqual([
      { importedId: null, date: '2026-10-03', amount: -15000, payee: 'Maria Silva', memo: null },
      { importedId: null, date: '2026-10-05', amount: 800000, payee: 'Cliente Alfa', memo: null },
    ]);
  });

  it('Itaú: lançamento como descrição e valor (R$) como valor', () => {
    const r = parseCSV('data;lançamento;ag./origem;valor (R$);saldos (R$)\n03/10/2026;PIX TRANSF MARIA;0001;-150,00;1.000,00');
    expect(r.bank).toBe('itau');
    expect(r.rows[0]).toMatchObject({ date: '2026-10-03', amount: -15000, payee: 'PIX TRANSF MARIA' });
  });

  it('inverter à mão vence o padrão do banco', () => {
    expect(parseCSV('date,title,amount\n2026-10-03,Uber,23.90', false).rows[0]!.amount).toBe(2390);
  });
});
