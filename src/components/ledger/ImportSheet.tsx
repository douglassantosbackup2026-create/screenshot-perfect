// Importar extrato OFX ou CSV para uma conta, com prévia antes de gravar.
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AccountSelect } from "@/components/ledger/fields";
import { handleResult, xpToast } from "@/components/feedback";
import { parseCSV, parseOFX, type ImportedTx } from "@/lib/calc/import";
import { formatMoney } from "@/lib/calc/format";
import { demo, type DemoState } from "@/lib/data/demo-store";

const MAX_BYTES = 2 * 1024 * 1024;

export function ImportSheet({ s, open, onClose }: { s: DemoState; open: boolean; onClose: () => void }) {
  const [accountId, setAccountId] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [invert, setInvert] = useState(false);
  useEffect(() => {
    if (!open) return;
    setAccountId(s.accounts[0]?.id ?? null);
    setText(null);
    setFileName("");
    setInvert(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  if (!open) return null;

  const isOfx = /\.(ofx|qfx)$/i.test(fileName) || (text ?? "").includes("<STMTTRN>");
  const parsed: { rows: ImportedTx[]; skipped: number } = text === null ? { rows: [], skipped: 0 } : isOfx ? { rows: parseOFX(text), skipped: 0 } : parseCSV(text, invert);

  async function pick(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      toast.error("Arquivo grande demais (até 2 MB).");
      return;
    }
    // OFX de bancos brasileiros costuma vir em Latin-1; CSV, em UTF-8.
    const buf = await file.arrayBuffer();
    const utf8 = new TextDecoder("utf-8").decode(buf);
    setText(utf8.includes("�") ? new TextDecoder("windows-1252").decode(buf) : utf8);
    setFileName(file.name);
  }

  function confirm() {
    try {
      const r = demo.importTransactions(accountId ?? "", parsed.rows);
      const parts = [`${r.added} ${r.added === 1 ? "novo" : "novos"}`];
      if (r.matched) parts.push(`${r.matched} ${r.matched === 1 ? "ligado" : "ligados"} a lançamentos seus`);
      if (r.duplicates) parts.push(`${r.duplicates} já ${r.duplicates === 1 ? "estava" : "estavam"} importados`);
      xpToast(`Extrato importado: ${parts.join(", ")}.`, r.xpAwarded);
      handleResult(r);
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="mx-auto max-h-[90vh] max-w-[480px] overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle className="text-xl font-semibold">Importar extrato</SheetTitle>
          <SheetDescription>
            Baixe o extrato no app do banco em OFX (ou CSV) e escolha o arquivo. Ele é lido aqui no aparelho; o app não pede senha do banco.
          </SheetDescription>
        </SheetHeader>
        {s.accounts.length === 0 ? (
          <p className="mt-6 pb-4 text-sm text-muted-foreground">Cadastre uma conta em Contas antes de importar.</p>
        ) : (
          <div className="mt-6 space-y-4 pb-4">
            <AccountSelect label="Para a conta" value={accountId} onChange={setAccountId} accounts={s.accounts} />
            <div>
              <label htmlFor="import-file" className="text-sm font-semibold">
                Arquivo
              </label>
              <input
                id="import-file"
                type="file"
                accept=".ofx,.qfx,.csv,.txt"
                onChange={(e) => pick(e.target.files?.[0])}
                className="mt-1.5 block w-full rounded-xl bg-muted p-3 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-primary file:px-4 file:py-2 file:font-semibold file:text-primary-foreground"
              />
            </div>
            {text !== null && !isOfx && (
              <label className="flex min-h-12 items-center justify-between gap-4 rounded-xl bg-muted px-4">
                <span className="text-sm">Fatura de cartão: compras vêm como valores positivos</span>
                <Switch checked={invert} onCheckedChange={setInvert} />
              </label>
            )}
            {text !== null && (
              <div className="rounded-2xl bg-muted p-4">
                <p className="text-sm font-semibold">
                  {parsed.rows.length} {parsed.rows.length === 1 ? "lançamento encontrado" : "lançamentos encontrados"}
                  {parsed.skipped > 0 && <span className="font-normal text-muted-foreground"> · {parsed.skipped} linhas ignoradas</span>}
                </p>
                {parsed.rows.length === 0 && (
                  <p className="mt-1 text-sm text-muted-foreground">Não deu para ler. O CSV precisa de colunas de data, descrição e valor.</p>
                )}
                <ul className="mt-2 space-y-1 text-sm">
                  {parsed.rows.slice(0, 5).map((r, i) => (
                    <li key={i} className="flex justify-between gap-4">
                      <span className="truncate">{r.payee}</span>
                      <span className={"money shrink-0 " + (r.amount >= 0 ? "text-primary" : "")}>{formatMoney(r.amount)}</span>
                    </li>
                  ))}
                  {parsed.rows.length > 5 && <li className="text-muted-foreground">e mais {parsed.rows.length - 5}…</li>}
                </ul>
                <p className="mt-3 text-xs text-muted-foreground">
                  Lançamentos que você já fez à mão, com o mesmo valor e até 3 dias de diferença, ficam ligados ao do banco em vez de duplicar.
                </p>
              </div>
            )}
            <Button className="w-full" disabled={!accountId || parsed.rows.length === 0} onClick={confirm}>
              Importar
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
