import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/seo";
import { Plus, Trash2 } from "lucide-react";
import { AreaTabs } from "@/components/nav/areas";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ConfirmButton";
import { EmptyState } from "@/components/EmptyState";
import { HideValuesToggle } from "@/components/HideValuesToggle";
import { ShowValuesProvider, useShowValues } from "@/hooks/use-show-values";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { BottomSheetContent } from "@/components/BottomSheet";
import { NumberField, Segmented } from "@/components/forms";
import { HIDDEN } from "@/lib/labels";
import { ACCOUNT_KINDS, accountGroup, accountKindLabel, fromCents, toCents, type AccountKind } from "@/lib/calc/ledger";
import type { RuleOp } from "@/lib/calc/categorize";
import { formatMoney } from "@/lib/calc/format";
import { demo, useDemo, type Account, type CategoryKind, type DemoState } from "@/lib/data/demo-store";
import { accountsOverview } from "@/lib/data/selectors";
import { cn } from "@/lib/utils";
import { errMsg } from "@/lib/errors";

export const Route = createFileRoute("/_authenticated/contas")({
  head: () => pageHead("Contas", "Suas contas, cartões e categorias, e as regras que categorizam os lançamentos sozinhas."),
  component: Accounts,
});

type Editing = { account: Account | null } | null;

function Accounts() {
  const s = useDemo();
  const { showValues, toggle: toggleValues } = useShowValues();
  const [editing, setEditing] = useState<Editing>(null);
  const overview = accountsOverview(s);
  const money = (cents: number) => (showValues ? formatMoney(cents) : HIDDEN);

  return (
    <ShowValuesProvider value={showValues}>
    <main className="mx-auto w-full max-w-[480px] px-5 pb-32 pt-8 lg:max-w-4xl lg:px-8 lg:pb-12">
      <AreaTabs />
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1>Contas</h1>
          <p className="mt-1 text-sm text-muted-foreground">Saldos calculados a partir do que você lançou ou importou.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <HideValuesToggle showValues={showValues} onToggle={toggleValues} />
          <Button onClick={() => setEditing({ account: null })}>
            <Plus size={16} strokeWidth={2} aria-hidden /> Nova conta
          </Button>
        </div>
      </header>

      {s.accounts.length === 0 ? (
        <EmptyState
          className="mt-6"
          title="Nenhuma conta ainda"
          action={<Button onClick={() => setEditing({ account: null })}>Cadastrar a primeira conta</Button>}
        >
          Comece pela conta corrente onde cai a sua renda. Com as contas e o cartão aqui, o mês inteiro fica num lugar só.
        </EmptyState>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {overview.groups
            .filter((g) => g.accounts.length > 0)
            .map((g) => (
              <section key={g.group} className="rounded-2xl bg-card p-5 shadow-card" aria-label={g.label}>
                <div className="flex items-baseline justify-between gap-4">
                  <h2 className="text-base">{g.label}</h2>
                  <span className={cn("money shrink-0 whitespace-nowrap text-sm font-semibold", g.total < 0 && "text-destructive")}>{money(g.total)}</span>
                </div>
                <ul className="mt-3 divide-y divide-border">
                  {g.accounts.map((a) => (
                    <li key={a.id}>
                      <button
                        type="button"
                        onClick={() => setEditing({ account: a })}
                        className="flex w-full items-center justify-between gap-4 rounded-xl px-1 py-3 text-left hover:bg-muted"
                      >
                        <span>
                          <span className="block font-semibold">{a.name}</span>
                          <span className="block text-xs text-muted-foreground">{accountKindLabel(a.kind)}</span>
                        </span>
                        <span className={cn("money shrink-0 whitespace-nowrap text-sm", a.balance < 0 && "text-destructive")}>{money(a.balance)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
        </div>
      )}
      <p className="mt-4 text-xs leading-5 text-muted-foreground">
        Estes saldos são do livro-caixa. O Patrimônio continua sendo a foto que você informa para o plano de aposentadoria; os dois não se somam.
      </p>

      <Categories s={s} />
      <Rules s={s} />
      <AccountSheet editing={editing} onClose={() => setEditing(null)} />
    </main>
    </ShowValuesProvider>
  );
}

function Categories({ s }: { s: DemoState }) {
  const [kind, setKind] = useState<CategoryKind>("despesa");
  const [name, setName] = useState("");
  function add() {
    try {
      demo.saveCategory({ name, kind });
      setName("");
    } catch (e) {
      toast.error(errMsg(e));
    }
  }
  return (
    <section className="mt-8 rounded-2xl bg-card p-5 shadow-card" aria-label="Categorias">
      <h2 className="text-lg">Categorias</h2>
      <div className="mt-3">
        <Segmented
          label="Tipo de categoria"
          value={kind}
          onChange={setKind}
          options={[
            { value: "despesa", label: "Gastos" },
            { value: "receita", label: "Receitas" },
          ]}
        />
      </div>
      <ul className="mt-3 flex flex-wrap gap-2">
        {s.categories
          .filter((c) => c.kind === kind)
          .map((c) => (
            <li key={c.id} className="flex min-h-10 items-center gap-1 rounded-full border border-border pl-4 pr-1 text-sm">
              {c.name}
              <ConfirmButton
                size="sm"
                confirmLabel="Excluir?"
                aria-label={`Excluir ${c.name}`}
                className="min-w-11 rounded-full text-muted-foreground"
                onConfirm={() => {
                  demo.deleteCategory(c.id);
                  toast(`Categoria “${c.name}” excluída. Os lançamentos dela ficaram sem categoria.`);
                }}
              >
                <Trash2 size={14} aria-hidden />
              </ConfirmButton>
            </li>
          ))}
      </ul>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <Input aria-label="Nova categoria" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} className="h-11" placeholder="Nova categoria" />
        <Button type="submit" variant="outline">
          Adicionar
        </Button>
      </form>
    </section>
  );
}

function Rules({ s }: { s: DemoState }) {
  const [op, setOp] = useState<RuleOp>("contem");
  const [value, setValue] = useState("");
  const [categoryId, setCategoryId] = useState<string | undefined>(undefined);
  const [renameTo, setRenameTo] = useState("");
  const categories = new Map(s.categories.map((c) => [c.id, c.name]));
  function add() {
    try {
      demo.saveCategoryRule({ op, value, categoryId: categoryId ?? "", renameTo });
      setValue("");
      setRenameTo("");
    } catch (e) {
      toast.error(errMsg(e));
    }
  }
  return (
    <section className="mt-4 rounded-2xl bg-card p-5 shadow-card" aria-label="Regras de categoria">
      <h2 className="text-lg">Regras de categoria</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Valem para lançamentos sem categoria, inclusive os importados. Quando duas regras servem, vale a mais específica.
      </p>
      {s.categoryRules.length > 0 && (
        <ul className="mt-3 divide-y divide-border text-sm">
          {s.categoryRules.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-4 py-2">
              <span>
                Descrição {r.op === "igual" ? "igual a" : "contém"} <strong>“{r.value}”</strong> → {categories.get(r.categoryId) ?? "?"}
                {r.renameTo && <span className="text-muted-foreground"> · renomear para “{r.renameTo}”</span>}
              </span>
              <button
                type="button"
                aria-label="Excluir regra"
                onClick={() => demo.deleteCategoryRule(r.id)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Trash2 size={14} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="mt-4 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <Segmented
          label="Como comparar"
          value={op}
          onChange={setOp}
          options={[
            { value: "contem", label: "Contém" },
            { value: "igual", label: "Igual a" },
          ]}
        />
        <Input aria-label="Texto da descrição" maxLength={80} value={value} onChange={(e) => setValue(e.target.value)} className="h-11" placeholder="Ex.: uber" />
        <Select value={categoryId ?? ""} onValueChange={setCategoryId}>
          <SelectTrigger className="h-11 rounded-xl bg-muted" aria-label="Categoria da regra">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            {s.categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input aria-label="Renomear para" maxLength={120} value={renameTo} onChange={(e) => setRenameTo(e.target.value)} className="h-11" placeholder="Renomear para (opcional)" />
        <Button type="submit" variant="outline" className="w-full">
          Criar regra
        </Button>
      </form>
    </section>
  );
}

function AccountSheet({ editing, onClose }: { editing: Editing; onClose: () => void }) {
  const account = editing?.account ?? null;
  const [name, setName] = useState("");
  const [kind, setKind] = useState<AccountKind>("corrente");
  const [opening, setOpening] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => {
    setName(account?.name ?? "");
    setKind(account?.kind ?? "corrente");
    // Em cartões e dívidas, a pessoa informa quanto deve; guardamos como saldo negativo.
    setOpening(account ? fromCents(Math.abs(account.openingBalance)) : null);
    setConfirmDelete(false);
  }, [editing, account]);
  if (!editing) return null;
  const debt = accountGroup(kind) === "dividas";

  function save() {
    try {
      const cents = toCents(opening ?? 0);
      demo.saveAccount({ id: account?.id, name, kind, openingBalance: debt ? -cents : cents });
      toast.success(account ? "Conta atualizada." : "Conta criada.");
      onClose();
    } catch (e) {
      toast.error(errMsg(e));
    }
  }

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <BottomSheetContent>
        <SheetHeader>
          <SheetTitle className="text-xl font-semibold">{account ? "Editar conta" : "Nova conta"}</SheetTitle>
          <SheetDescription>O app não se conecta ao banco nem pede senha. Os saldos vêm do que você lança ou importa.</SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-4 pb-4">
          <div>
            <label htmlFor="acc-name" className="text-sm font-semibold">
              Nome
            </label>
            <Input id="acc-name" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5 h-11" placeholder="Ex.: Nubank" />
          </div>
          <div role="radiogroup" aria-label="Tipo de conta" className="flex flex-wrap gap-2">
            {ACCOUNT_KINDS.map((k) => (
              <button
                key={k.key}
                type="button"
                role="radio"
                aria-checked={kind === k.key}
                onClick={() => setKind(k.key)}
                className={cn("min-h-10 rounded-full border px-4 text-sm", kind === k.key ? "border-primary font-semibold text-primary" : "border-border")}
              >
                {k.label}
              </button>
            ))}
          </div>
          <NumberField
            label={debt ? "Quanto você deve hoje" : "Saldo inicial"}
            value={opening}
            onChange={setOpening}
            prefix="R$"
            min={0}
            step={0.01}
            hint="O ponto de partida. Daqui em diante, o saldo segue os lançamentos."
          />
          <Button className="w-full" onClick={save}>
            {account ? "Salvar alterações" : "Criar conta"}
          </Button>
          {account &&
            (confirmDelete ? (
              <Button
                variant="destructive"
                className="w-full"
                onClick={() => {
                  demo.deleteAccount(account.id);
                  toast("Conta excluída com os lançamentos dela.");
                  onClose();
                }}
              >
                Confirmar: excluir conta e lançamentos
              </Button>
            ) : (
              <Button variant="ghost" className="w-full" onClick={() => setConfirmDelete(true)}>
                Excluir conta
              </Button>
            ))}
        </div>
      </BottomSheetContent>
    </Sheet>
  );
}
