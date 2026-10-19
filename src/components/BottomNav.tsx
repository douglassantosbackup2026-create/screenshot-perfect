import { Link } from "@tanstack/react-router";
import { BookOpen, CalendarDays, LineChart, User } from "lucide-react";

const items = [
  { to: "/hoje", label: "Hoje", icon: CalendarDays },
  { to: "/plano", label: "Plano", icon: LineChart },
  { to: "/diario", label: "Diário", icon: BookOpen },
  { to: "/perfil", label: "Perfil", icon: User },
] as const;

export function BottomNav() {
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card"
    >
      <ul className="mx-auto grid max-w-[480px] grid-cols-4">
        {items.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <Link
              to={to}
              className="flex min-h-14 flex-col items-center justify-center gap-1 text-xs text-muted-foreground transition-colors"
              activeProps={{ className: "text-primary font-semibold", "aria-current": "page" }}
            >
              <Icon size={22} strokeWidth={1.75} aria-hidden />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
