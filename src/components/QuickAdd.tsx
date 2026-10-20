import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Landmark, PiggyBank, Plus, Receipt, Target, Wallet, type LucideIcon } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/** Botão "+" amarelo com os atalhos de registro. */
export function QuickAdd({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const actions: { label: string; hint: string; icon: LucideIcon; go: () => void }[] = [
    {
      label: "Registrar aporte",
      hint: "O aporte deste mês, no Diário",
      icon: Wallet,
      go: () => navigate({ to: "/diario", search: { registrar: true } }),
    },
    {
      label: "Novo lançamento",
      hint: "Um gasto, uma receita ou uma transferência",
      icon: Receipt,
      go: () => navigate({ to: "/diario", search: { lancar: true } }),
    },
    {
      label: "Registrar patrimônio",
      hint: "Quanto você tem guardado hoje",
      icon: Landmark,
      go: () => navigate({ to: "/evolucao", search: { registrar: true } }),
    },
    {
      label: "Item do patrimônio",
      hint: "Previdência, investimento, imóvel ou dívida",
      icon: PiggyBank,
      go: () => navigate({ to: "/patrimonio", search: { novo: true } }),
    },
    {
      label: "Nova meta",
      hint: "Um valor ou um hábito",
      icon: Target,
      go: () => navigate({ to: "/evolucao", search: { meta: true } }),
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
    </>
  );
}
