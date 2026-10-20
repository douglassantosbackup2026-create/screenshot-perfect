import { Link } from "@tanstack/react-router";
import { QuickAdd } from "@/components/QuickAdd";
import { useDemo } from "@/lib/data/demo-store";

const tabs = [
  { to: "/hoje", label: "Jornada" },
  { to: "/evolucao", label: "Progresso" },
  { to: "/plano", label: "Meu plano" },
  { to: "/patrimonio", label: "Patrimônio" },
  { to: "/diario", label: "Diário" },
] as const;

/** Menu do topo em telas grandes: abas em pílula, "+" de registro e acesso ao perfil. */
export function TopNav() {
  const s = useDemo();
  const initial = (s.profile.displayName || "V").charAt(0).toUpperCase();
  return (
    <header className="mx-auto hidden w-full max-w-6xl items-center justify-between gap-6 px-8 pt-6 lg:flex">
      <Link to="/hoje" className="flex items-center gap-2 rounded-full bg-card px-4 py-2.5 font-semibold tracking-tight shadow-card">
        <span className="h-2.5 w-2.5 rounded-full bg-primary" aria-hidden />
        Previdência Intelligence
      </Link>
      <nav aria-label="Navegação principal" className="rounded-full bg-card p-1.5 shadow-card">
        <ul className="flex items-center gap-1">
          {tabs.map(({ to, label }) => (
            <li key={to}>
              <Link
                to={to}
                className="block rounded-full px-5 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                activeProps={{ className: "!bg-primary !text-primary-foreground font-semibold", "aria-current": "page" }}
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="flex items-center gap-3">
        <QuickAdd className="h-11 w-11" />
        <Link
          to="/perfil"
          aria-label="Perfil"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-card font-semibold shadow-card ring-1 ring-white/10 hover:ring-primary"
          activeProps={{ className: "!ring-primary text-primary" }}
        >
          {initial}
        </Link>
      </div>
    </header>
  );
}
