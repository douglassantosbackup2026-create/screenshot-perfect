// Pergunta, uma vez por versão da política, se pode medir o uso do site (analytics próprio).
// Reabre pelo "Preferências de privacidade" (openConsentPreferences).
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { CONSENT_EVENTS, getConsent, setConsent, type ConsentChoice } from "@/lib/analytics/analytics";

export function ConsentBanner() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Fora do preview do editor (iframe): lá não há visitante de verdade.
    if (window.self !== window.top) return;
    setOpen(getConsent() === null);
    const reopen = () => setOpen(true);
    window.addEventListener(CONSENT_EVENTS.open, reopen);
    return () => window.removeEventListener(CONSENT_EVENTS.open, reopen);
  }, []);

  if (!open) return null;

  function choose(c: ConsentChoice) {
    setOpen(false);
    void setConsent(c);
  }

  return (
    <section
      role="dialog"
      aria-label="Privacidade"
      aria-live="polite"
      className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+1rem)] z-[60] mx-auto max-w-[560px] rounded-2xl bg-card p-5 shadow-card ring-1 ring-border"
    >
      <p className="font-semibold">Podemos medir como o site é usado?</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Contamos visitas e etapas (como usar a calculadora ou criar a conta) para melhorar o app. Fica no nosso próprio banco, sem
        empresas de anúncio, e nunca inclui seus valores. Veja a{" "}
        <Link to="/privacidade" className="text-primary underline underline-offset-2">
          política de privacidade
        </Link>
        .
      </p>
      <div className="mt-4 flex gap-2">
        <Button className="flex-1" onClick={() => choose("aceito")}>
          Aceitar
        </Button>
        <Button className="flex-1" variant="outline" onClick={() => choose("recusado")}>
          Recusar
        </Button>
      </div>
    </section>
  );
}
