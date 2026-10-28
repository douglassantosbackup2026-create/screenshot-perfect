import { Landmark, Sunrise, Wallet, type LucideIcon } from "lucide-react";
import { PILLARS, type Pillar } from "@/content/pillars";

const ICONS: Record<Pillar["key"], LucideIcon> = { orcamento: Wallet, patrimonio: Landmark, aposentadoria: Sunrise };

/** Os três pilares do app em cards. `show` escolhe a linha de apoio: o app que cada um substitui ou onde fica no menu. */
export function PillarCards({ show }: { show: "replaces" | "where" }) {
  return (
    <ul className="space-y-3">
      {PILLARS.map((p) => {
        const Icon = ICONS[p.key];
        return (
          <li key={p.key} className="flex gap-4 rounded-2xl bg-card p-4 shadow-card">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Icon size={20} strokeWidth={1.75} aria-hidden />
            </span>
            <div>
              <p className="font-semibold">{p.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{p.text}</p>
              <p className="mt-2 text-xs font-semibold text-primary">{show === "replaces" ? p.replaces : `No menu: ${p.where}`}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
