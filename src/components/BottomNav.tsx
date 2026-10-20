import { Link } from "@tanstack/react-router";
import { LineChart, Map, TrendingUp, User } from "lucide-react";
import { QuickAdd } from "@/components/QuickAdd";

const left = [
  { to: "/hoje", label: "Jornada", icon: Map },
  { to: "/evolucao", label: "Progresso", icon: TrendingUp },
] as const;
const right = [
  { to: "/plano", label: "Meu plano", icon: LineChart },
  { to: "/perfil", label: "Perfil", icon: User },
] as const;

function Item({ to, label, icon: Icon }: (typeof left)[number] | (typeof right)[number]) {
  return (
    <li>
      <Link
        to={to}
        className="flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
        activeProps={{ className: "!text-primary font-semibold", "aria-current": "page" }}
      >
        <Icon size={22} strokeWidth={1.75} aria-hidden />
        {label}
      </Link>
    </li>
  );
}

/** Barra flutuante do celular, com o "+" de registro no centro. */
export function BottomNav() {
  return (
    <nav aria-label="Navegação principal" className="fixed inset-x-4 bottom-4 z-40 lg:hidden">
      <ul className="mx-auto grid max-w-[440px] grid-cols-5 items-center rounded-full bg-card/95 px-2 shadow-card ring-1 ring-white/5 backdrop-blur">
        {left.map((i) => (
          <Item key={i.to} {...i} />
        ))}
        <li className="flex justify-center">
          <QuickAdd className="-mt-7 h-14 w-14 ring-4 ring-background" />
        </li>
        {right.map((i) => (
          <Item key={i.to} {...i} />
        ))}
      </ul>
    </nav>
  );
}
