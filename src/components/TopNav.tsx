import { Link, useLocation } from "@tanstack/react-router";
import { QuickAdd } from "@/components/QuickAdd";
import { AREAS, areaOf } from "@/components/nav/areas";
import { useDemo } from "@/lib/data/demo-store";
import { cn } from "@/lib/utils";

function ProfileButton({ className }: { className?: string }) {
  const s = useDemo();
  const initial = (s.profile.displayName || "V").charAt(0).toUpperCase();
  return (
    <Link
      to="/perfil"
      aria-label="Perfil"
      className={cn(
        "flex h-11 w-11 items-center justify-center rounded-full bg-card font-semibold shadow-card ring-1 ring-white/10 hover:ring-primary",
        className,
      )}
      activeProps={{ className: "!ring-primary text-primary" }}
    >
      {initial}
    </Link>
  );
}

/** Menu do topo em telas grandes: as quatro áreas em pílula, "+" de registro e acesso ao perfil. */
export function TopNav() {
  const current = areaOf(useLocation().pathname)?.key;
  return (
    <header className="mx-auto hidden w-full max-w-6xl items-center justify-between gap-6 px-8 pt-6 lg:flex">
      <Link to="/hoje" className="flex items-center gap-2 rounded-full bg-card px-4 py-2.5 font-semibold tracking-tight shadow-card">
        <span className="h-2.5 w-2.5 rounded-full bg-primary" aria-hidden />
        Previdência Intelligence
      </Link>
      <nav aria-label="Navegação principal" className="rounded-full bg-card p-1.5 shadow-card">
        <ul className="flex items-center gap-1">
          {AREAS.map((a) => (
            <li key={a.key}>
              <Link
                to={a.to}
                aria-current={current === a.key ? "page" : undefined}
                className={cn(
                  "block rounded-full px-5 py-2 text-sm transition-colors",
                  current === a.key ? "bg-primary font-semibold text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {a.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="flex items-center gap-3">
        <QuickAdd className="h-11 w-11" />
        <ProfileButton />
      </div>
    </header>
  );
}

/** Topo compacto do celular: marca e acesso ao perfil (a barra de baixo fica com as áreas). */
export function MobileHeader() {
  return (
    <header className="mx-auto flex w-full max-w-[480px] items-center justify-between px-5 pt-4 lg:hidden">
      <Link to="/hoje" className="flex items-center gap-2 text-sm font-semibold tracking-tight">
        <span className="h-2.5 w-2.5 rounded-full bg-primary" aria-hidden />
        Previdência Intelligence
      </Link>
      <ProfileButton className="h-10 w-10" />
    </header>
  );
}
