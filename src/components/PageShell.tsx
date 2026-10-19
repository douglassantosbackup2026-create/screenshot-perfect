import type { ReactNode } from "react";

export function PageShell({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: string;
  children?: ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-[480px] px-5 pb-28 pt-10">
      <h1 className="text-foreground">{title}</h1>
      {intro && <p className="mt-3 max-w-[70ch] text-muted-foreground">{intro}</p>}
      <div className="mt-8 space-y-6">{children}</div>
    </main>
  );
}

export function ComingSoon({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
      {text}
    </div>
  );
}
