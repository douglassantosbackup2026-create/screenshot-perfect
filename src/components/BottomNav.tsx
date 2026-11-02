import { Link, useLocation } from "@tanstack/react-router";
import { QuickAdd } from "@/components/QuickAdd";
import { AREAS, areaOf, type Area } from "@/components/nav/areas";
import { cn } from "@/lib/utils";

function Item({ area, active }: { area: Area; active: boolean }) {
  const Icon = area.icon;
  return (
    <li>
      <Link
        to={area.to}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex min-h-14 min-w-0 flex-col items-center justify-center gap-0.5 text-[10px] transition-colors hover:text-foreground min-[360px]:text-xs",
          active ? "font-semibold text-primary" : "text-muted-foreground",
        )}
      >
        <Icon size={22} strokeWidth={1.75} aria-hidden />
        <span className="max-w-full truncate">{area.label}</span>
      </Link>
    </li>
  );
}

/** Barra flutuante do celular: as quatro áreas, com o "+" de registro no centro. O Perfil fica no topo. */
export function BottomNav() {
  const current = areaOf(useLocation().pathname)?.key;
  const [a, b, c, d] = AREAS as [Area, Area, Area, Area];
  return (
    <nav aria-label="Navegação principal" className="fixed inset-x-4 bottom-4 z-40 lg:hidden">
      {/* minmax(0,1fr): em 320px as colunas encolhem em vez de empurrar "Progresso" para fora da tela. */}
      <ul className="mx-auto grid max-w-[440px] grid-cols-[repeat(5,minmax(0,1fr))] items-center rounded-full bg-card/95 px-2 shadow-card ring-1 ring-white/5 backdrop-blur">
        <Item area={a} active={current === a.key} />
        <Item area={b} active={current === b.key} />
        <li className="flex justify-center">
          <QuickAdd className="-mt-7 h-14 w-14 ring-4 ring-background" />
        </li>
        <Item area={c} active={current === c.key} />
        <Item area={d} active={current === d.key} />
      </ul>
    </nav>
  );
}
