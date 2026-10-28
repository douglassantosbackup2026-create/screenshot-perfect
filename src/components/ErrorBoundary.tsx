// Barreiras de erro: uma falha numa tela ou num card não derruba o app inteiro.
import { Component, type ErrorInfo, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { demo } from "@/lib/data/demo-store";
import { reportLovableError } from "@/lib/lovable-error-reporting";

type Props = {
  children: ReactNode;
  fallback: (reset: () => void) => ReactNode;
  /** Quando muda (por exemplo, a rota), a barreira tenta de novo sozinha. */
  resetKey?: unknown;
};

export class ErrorBoundary extends Component<Props, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
    reportLovableError(error, { boundary: "app_error_boundary" });
  }

  override componentDidUpdate(prev: Props) {
    if (this.state.failed && prev.resetKey !== this.props.resetKey) this.setState({ failed: false });
  }

  reset = () => this.setState({ failed: false });

  override render() {
    return this.state.failed ? this.props.fallback(this.reset) : this.props.children;
  }
}

/** Baixa os dados da pessoa mesmo com a tela quebrada, para ela nunca ficar sem saída. */
function downloadData() {
  try {
    const blob = new Blob([JSON.stringify(demo.exportData(), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "meus-dados-previdencia-intelligence.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 0);
  } catch {
    /* sem dados carregados, não há o que baixar */
  }
}

/** Tela de erro dentro da área logada: a navegação continua de pé. */
export function PageError({ message, onRetry }: { message?: string | undefined; onRetry: () => void }) {
  return (
    <main className="mx-auto w-full max-w-[480px] px-5 pb-32 pt-10 lg:max-w-3xl" role="alert">
      <AlertTriangle className="text-primary" size={28} aria-hidden />
      <h1 className="mt-3 text-2xl">Esta tela não carregou</h1>
      <p className="mt-2 text-muted-foreground">{message ?? "Algo falhou ao mostrar esta parte. Seus dados continuam salvos."}</p>
      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <Button onClick={onRetry}>Tentar de novo</Button>
        <Button variant="outline" onClick={downloadData}>
          Baixar meus dados
        </Button>
        <Button asChild variant="ghost">
          <Link to="/hoje">Voltar ao início</Link>
        </Button>
      </div>
    </main>
  );
}

/** Um card que falha vira um aviso pequeno; o resto da tela continua. */
export function CardBoundary({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <ErrorBoundary
      fallback={(reset) => (
        <section className={`rounded-2xl bg-card p-5 text-sm shadow-card ${className ?? ""}`} role="alert">
          <p className="text-muted-foreground">Não foi possível mostrar isto agora.</p>
          <button type="button" onClick={reset} className="mt-2 min-h-11 font-semibold text-primary">
            Tentar de novo
          </button>
        </section>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}
