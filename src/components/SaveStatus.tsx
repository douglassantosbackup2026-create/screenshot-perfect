import { useEffect } from "react";
import { CloudOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { consumeRepairNotice, retrySave, useSaveStatus } from "@/lib/data/demo-store";

/** Mostra quando os dados não chegaram ao banco. Salvo é o normal e não aparece. Pode aparecer em mais de um lugar. */
export function SaveStatus() {
  const status = useSaveStatus();

  if (status === "saving") {
    return (
      <span role="status" className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 size={14} className="animate-spin" aria-hidden />
        Salvando…
      </span>
    );
  }
  if (status === "error" || status === "too-large" || status === "blocked") {
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

const NOTICES: Partial<Record<ReturnType<typeof useSaveStatus>, string>> = {
  conflict: "Seus dados mudaram em outra aba ou aparelho. Carregamos a versão mais recente; confira sua última alteração.",
  "too-large":
    "Seus dados passaram do limite de armazenamento e a última alteração não foi salva no servidor. Ela continua guardada neste aparelho. Exporte seus dados no Perfil e fale com o suporte.",
  blocked: "Não foi possível salvar: sua assinatura não está ativa. Suas alterações continuam guardadas neste aparelho.",
};

/** Avisos de gravação em toast. Montar uma vez só (no layout), senão cada aviso aparece repetido. */
export function SaveNotices() {
  const status = useSaveStatus();
  useEffect(() => {
    const text = NOTICES[status];
    if (text) toast(text, { duration: status === "conflict" ? 8000 : 12000 });
    // Dados consertados ao carregar (ao abrir o app ou depois de um conflito): avisa uma vez.
    const repaired = consumeRepairNotice();
    if (repaired) {
      toast(
        repaired.dropped
          ? `${repaired.dropped === 1 ? "Um registro salvo estava com defeito e ficou de fora" : `${repaired.dropped} registros salvos estavam com defeito e ficaram de fora`}. Se notar algo faltando, exporte seus dados no Perfil e fale com o suporte.`
          : "Alguns dados salvos estavam com defeito e voltaram ao padrão. Confira suas preferências no Perfil.",
        { duration: 12000 },
      );
    }
  }, [status]);
  return null;
}
