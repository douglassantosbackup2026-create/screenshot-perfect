import { useEffect } from "react";
import { CloudOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { retrySave, useSaveStatus } from "@/lib/data/demo-store";

/** Mostra quando os dados não chegaram ao banco. Salvo é o normal e não aparece. */
export function SaveStatus() {
  const status = useSaveStatus();

  useEffect(() => {
    if (status === "conflict") {
      toast("Seus dados mudaram em outra aba ou aparelho. Carregamos a versão mais recente; confira sua última alteração.", {
        duration: 8000,
      });
    }
  }, [status]);

  if (status === "saving") {
    return (
      <span role="status" className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 size={14} className="animate-spin" aria-hidden />
        Salvando…
      </span>
    );
  }
  if (status === "error") {
    return (
      <button
        type="button"
        role="alert"
        onClick={() => void retrySave()}
        className="flex min-h-11 items-center gap-1.5 rounded-full bg-destructive/15 px-3 text-xs font-semibold text-destructive"
      >
        <CloudOff size={14} aria-hidden />
        Não salvo · tentar de novo
      </button>
    );
  }
  return null;
}
