import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Landmark, Plus, Receipt, Wallet, type LucideIcon } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { TransactionSheet, type TxEditing } from "@/components/ledger/TransactionSheet";
import { useDemo } from "@/lib/data/demo-store";
import { cn } from "@/lib/utils";

/** Botão "+" amarelo com os atalhos de registro. O lançamento abre aqui mesmo, sem trocar de tela. */
export function QuickAdd({ className }: { className?: string }) {
  const s = useDemo();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TxEditing>(null);
  const navigate = useNavigate();

  const actions: { label: string; hint: string; icon: LucideIcon; go: () => void }[] = [
    {
      label: "Novo lançamento",
      hint: "Um gasto, uma receita ou uma transferência",
      icon: Receipt,
      go: () => (s.accounts.length ? setEditing({ tx: null }) : navigate({ to: "/contas" })),
    },
    {
      label: "Registrar aporte",
      hint: "Quanto você guardou para a aposentadoria neste mês",
      icon: Wallet,
      go: () => navigate({ to: "/diario", search: { registrar: true } }),
    },
    {
      label: "Atualizar patrimônio",
      hint: "Previdência, investimentos, imóveis e dívidas",
      icon: Landmark,
      go: () => navigate({ to: "/patrimonio" }),
    },
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Registrar"
        className={cn(
          "flex items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_8px_24px_-8px_rgb(246_200_0/0.6)] transition-transform hover:scale-105",
          className,
        )}
      >
        <Plus size={24} strokeWidth={2.25} aria-hidden />
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="mx-auto max-w-[480px] rounded-t-3xl">
          <SheetHeader>
            <SheetTitle className="text-xl font-semibold">Registrar</SheetTitle>
            <SheetDescription>Leva menos de um minuto.</SheetDescription>
          </SheetHeader>
          <ul className="mt-5 space-y-2 pb-4">
            {actions.map(({ label, hint, icon: Icon, go }) => (
              <li key={label}>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    go();
                  }}
                  className="flex min-h-14 w-full items-center gap-3 rounded-2xl bg-card px-4 py-3 text-left shadow-card transition-colors hover:bg-muted"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
                    <Icon size={18} strokeWidth={1.75} aria-hidden />
                  </span>
                  <span>
                    <span className="block font-semibold">{label}</span>
                    <span className="block text-sm text-muted-foreground">{hint}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </SheetContent>
      </Sheet>
      <TransactionSheet s={s} editing={editing} onClose={() => setEditing(null)} />
    </>
  );
}
