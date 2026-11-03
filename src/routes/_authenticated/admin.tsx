import { createFileRoute, Link, Outlet, redirect, useLocation, useNavigate } from "@tanstack/react-router";
import { staffStatus } from "@/lib/auth/roles";
import { ROLE_LABEL, visibleModules, type AdminModule } from "@/lib/admin/modules";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

// Painel administrativo: o layout confere quem é da equipe e monta o menu pelos perfis; cada módulo confere
// o próprio acesso (requireModule) e o banco confere de novo em cada função.
export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    const s = await staffStatus();
    // Perfil da equipe com segundo fator ativo e ainda não confirmado neste login: confirmar no Perfil.
    if (!s.roles.length && s.mfaNeeded) throw redirect({ to: "/perfil", hash: "seguranca", replace: true });
    if (!s.roles.length) throw redirect({ to: "/hoje", replace: true });
    return { staff: s.roles };
  },
  component: AdminLayout,
});

function groups(mods: AdminModule[]) {
  const out: { name: string; items: AdminModule[] }[] = [];
  for (const m of mods) {
    const g = out.find((x) => x.name === m.group);
    if (g) g.items.push(m);
    else out.push({ name: m.group, items: [m] });
  }
  return out;
}

function AdminLayout() {
  const { staff } = Route.useRouteContext();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const mods = visibleModules(staff);
  const current = mods.find((m) => m.path === pathname) ?? mods.find((m) => m.path !== "/admin" && pathname.startsWith(m.path)) ?? mods[0];

  return (
    <div className="mx-auto w-full max-w-6xl px-5 pb-28 pt-6 lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-8 lg:px-8 lg:pb-12">
      <aside className="hidden lg:block" aria-label="Seções do painel">
        <nav className="sticky top-6 space-y-5">
          <div>
            <p className="font-semibold">Painel administrativo</p>
            <p className="text-xs text-muted-foreground">{staff.map((r) => ROLE_LABEL[r]).join(" · ")}</p>
          </div>
          {groups(mods).map((g) => (
            <div key={g.name || "inicio"}>
              {g.name && <p className="eyebrow mb-1">{g.name}</p>}
              <ul>
                {g.items.map((m) => (
                  <li key={m.path}>
                    <Link
                      to={m.path}
                      aria-current={m === current ? "page" : undefined}
                      className={cn(
                        "flex min-h-10 items-center rounded-xl px-3 text-sm",
                        m === current ? "bg-card font-semibold text-primary shadow-card" : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {m.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      {/* No celular, as seções viram um seletor no topo. */}
      <div className="mb-6 lg:hidden">
        <p className="text-xs text-muted-foreground">Painel administrativo · {staff.map((r) => ROLE_LABEL[r]).join(" · ")}</p>
        <Select value={current?.path ?? ""} onValueChange={(v) => navigate({ to: v })}>
          <SelectTrigger className="mt-1 h-11 rounded-xl bg-card" aria-label="Seção do painel">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {groups(mods).map((g) => (
              <SelectGroup key={g.name || "inicio"}>
                {g.name && <SelectLabel>{g.name}</SelectLabel>}
                {g.items.map((m) => (
                  <SelectItem key={m.path} value={m.path}>
                    {m.title}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>

      <main className="min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
