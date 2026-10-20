// Pergunta, uma vez, se a pessoa aceita dados de uso anônimos. Só aparece se o analytics estiver configurado.
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { analyticsEnabled, getConsent, onConsentChange, setConsent, trackOp } from "@/lib/analytics";
import { observeOps } from "@/lib/data/demo-store";

export function ConsentBanner() {
  const [ask, setAsk] = useState(false);
  useEffect(() => {
    if (!analyticsEnabled()) return;
    const update = () => setAsk(getConsent() === null);
    update();
    const off = onConsentChange(update);
    const stop = observeOps(trackOp);
    return () => {
      off();
      stop();
    };
  }, []);
  if (!ask) return null;
  return (
    <div role="dialog" aria-label="Dados de uso" className="fixed inset-x-4 bottom-24 z-50 mx-auto max-w-[480px] rounded-2xl bg-card p-4 shadow-card ring-1 ring-white/10 lg:bottom-6">
      <p className="text-sm">
        Podemos medir o uso do app de forma anônima para melhorá-lo? Nunca enviamos valores, nomes ou e-mails.{" "}
        <Link to="/privacidade" className="text-primary underline">
          Saiba mais
        </Link>
      </p>
      <div className="mt-3 flex gap-2">
        <Button size="sm" onClick={() => setConsent(true)}>
          Pode medir
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setConsent(false)}>
          Agora não
        </Button>
      </div>
    </div>
  );
}
