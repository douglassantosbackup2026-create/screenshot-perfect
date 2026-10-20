// As quatro áreas do app, iguais no celular e no desktop, e as sub-abas de cada uma.
// Única fonte para BottomNav, TopNav e AreaTabs: adicionar uma tela aqui a coloca em todos os menus.
import { Link, useLocation } from "@tanstack/react-router";
import { LineChart, Map, TrendingUp, Wallet, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type AreaPath = "/hoje" | "/diario" | "/orcamento" | "/contas" | "/plano" | "/patrimonio" | "/evolucao";

export type Area = {
  key: "inicio" | "dinheiro" | "futuro" | "progresso";
  label: string;
  to: AreaPath;
  icon: LucideIcon;
  /** Rotas que pertencem à área (a aba fica ativa nelas). */
  match: string[];
  tabs?: { to: AreaPath; label: string }[];
};

export const AREAS: Area[] = [
  { key: "inicio", label: "Início", to: "/hoje", icon: Map, match: ["/hoje", "/revisao", "/fechamento"] },
  {
    key: "dinheiro",
    label: "Dinheiro",
    to: "/diario",
    icon: Wallet,
    match: ["/diario", "/orcamento", "/contas"],
    tabs: [
      { to: "/diario", label: "Lançamentos" },
      { to: "/orcamento", label: "Orçamento" },
      { to: "/contas", label: "Contas" },
    ],
  },
  {
    key: "futuro",
    label: "Futuro",
    to: "/plano",
    icon: LineChart,
    match: ["/plano", "/patrimonio"],
    tabs: [
      { to: "/plano", label: "Aposentadoria" },
      { to: "/patrimonio", label: "Patrimônio" },
    ],
  },
  { key: "progresso", label: "Progresso", to: "/evolucao", icon: TrendingUp, match: ["/evolucao"] },
];

const matches = (pathname: string, route: string) => pathname === route || pathname.startsWith(route + "/");

export function areaOf(pathname: string): Area | null {
  return AREAS.find((a) => a.match.some((m) => matches(pathname, m))) ?? null;
}

/** Sub-abas da área atual, no topo de cada tela da área. Sem sub-abas, não mostra nada. */
export function AreaTabs({ className }: { className?: string }) {
  const { pathname } = useLocation();
  const area = areaOf(pathname);
  if (!area?.tabs) return null;
  return (
    <nav aria-label={`Seções de ${area.label}`} className={cn("mb-6 flex max-w-md rounded-full bg-muted p-1", className)}>
      {area.tabs.map((t) => {
        const active = matches(pathname, t.to);
        return (
          <Link
            key={t.to}
            to={t.to}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-10 flex-1 items-center justify-center rounded-full px-3 text-sm transition-colors",
              active ? "bg-primary font-semibold text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
