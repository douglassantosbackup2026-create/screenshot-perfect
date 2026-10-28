import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Card de "ainda não há nada aqui": título, uma frase do que fazer e a ação principal. */
export function EmptyState({ title, children, action, className }: { title: string; children: ReactNode; action: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl bg-card p-6 text-center shadow-card", className)}>
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{children}</p>
      <div className="mt-4">{action}</div>
    </section>
  );
}
