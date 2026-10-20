// Moldura das páginas de texto legal (termos, privacidade): título, data de revisão e seções.
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";

export const LEGAL_UPDATED = "20 de outubro de 2026";

export function LegalPage({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-[680px] px-5 pb-16 pt-8">
      <Link to="/" className="text-sm font-semibold text-primary">
        Voltar ao início
      </Link>
      <h1 className="mt-6">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Atualizada em {LEGAL_UPDATED}</p>
      <p className="mt-4">{intro}</p>
      <div className="mt-8 space-y-8 leading-7 [&_h2]:text-lg [&_li]:mt-1 [&_p]:mt-2 [&_p]:text-muted-foreground [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:text-muted-foreground">
        {children}
      </div>
      <nav className="mt-12 flex flex-wrap gap-4 border-t border-border pt-6 text-sm" aria-label="Documentos">
        <Link to="/termos" className="text-primary hover:underline">
          Termos de uso
        </Link>
        <Link to="/privacidade" className="text-primary hover:underline">
          Política de privacidade
        </Link>
        <Link to="/sobre" className="text-primary hover:underline">
          Sobre o app
        </Link>
      </nav>
    </main>
  );
}
