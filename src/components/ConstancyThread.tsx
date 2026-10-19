import { cn } from "@/lib/utils";
import { monthShort, monthYear } from "@/lib/labels";

export type ThreadMonth = {
  month: string; // YYYY-MM-01
  state: "aporte" | "sem_aporte" | "vazio";
  tags?: string[];
  highlight?: boolean; // anima o preenchimento (registro recém-feito)
  onSelect?: () => void;
};

/** Ponto do fio: preenchido em ipê (aporte), vazado (sem aporte) ou nada (mês sem registro). */
export function ThreadDot({ state, highlight, size = 18 }: { state: ThreadMonth["state"]; highlight?: boolean; size?: number }) {
  if (state === "vazio") return <span aria-hidden style={{ width: size, height: size }} className="inline-block" />;
  return (
    <span
      aria-hidden
      style={{ width: size, height: size }}
      className={cn(
        "inline-block rounded-full border-2",
        state === "aporte" ? "border-accent bg-accent" : "border-muted-foreground bg-card",
        highlight && state === "aporte" && "animate-thread-fill",
      )}
    />
  );
}

const stateLabel = { aporte: "com aporte", sem_aporte: "registrado sem aporte", vazio: "sem registro" };

export function ConstancyThread({ months }: { months: ThreadMonth[] }) {
  if (!months.length) {
    return <p className="text-muted-foreground">Seu fio começa no primeiro aporte registrado.</p>;
  }
  return (
    <ol aria-label="Fio da constância" className="relative">
      {months.map((m, i) => {
        const last = i === months.length - 1;
        return (
          <li key={m.month} className="relative flex min-h-14 items-start gap-4">
            <div className="relative flex w-6 flex-col items-center self-stretch">
              <span className="z-10 mt-1 flex h-6 w-6 items-center justify-center">
                <ThreadDot state={m.state} highlight={m.highlight} />
              </span>
              {!last && (
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-7 bottom-0 w-0.5",
                    months[i + 1].state === "vazio" || m.state === "vazio"
                      ? "border-l-2 border-dotted border-border"
                      : "bg-border",
                  )}
                />
              )}
            </div>
            <button
              type="button"
              onClick={m.onSelect}
              disabled={!m.onSelect}
              className="-mt-0.5 flex min-h-11 flex-1 flex-wrap items-center gap-2 rounded-[10px] px-2 text-left enabled:hover:bg-muted"
            >
              <span className="font-semibold capitalize">{monthYear(m.month)}</span>
              <span className="sr-only">, {stateLabel[m.state]}</span>
              {m.state === "sem_aporte" && <span className="text-sm text-muted-foreground">sem aporte</span>}
              {m.tags?.map((t) => (
                <span key={t} className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                  {t}
                </span>
              ))}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/** Fio resumido na horizontal (tela Hoje). */
export function ThreadStrip({ months }: { months: ThreadMonth[] }) {
  return (
    <div className="flex items-end justify-between gap-1">
      {months.map((m, i) => (
        <div key={m.month} className="flex flex-1 flex-col items-center gap-2">
          <div className="relative flex h-6 w-full items-center justify-center">
            {i > 0 && <span aria-hidden className="absolute right-1/2 h-0.5 w-full bg-border" />}
            <span className="relative z-10 flex h-5 w-5 items-center justify-center rounded-full bg-card">
              {m.state === "vazio" ? (
                <span className="h-1.5 w-1.5 rounded-full bg-border" aria-hidden />
              ) : (
                <ThreadDot state={m.state} size={16} />
              )}
            </span>
          </div>
          <span className="text-xs text-muted-foreground">{monthShort(m.month)}</span>
        </div>
      ))}
    </div>
  );
}
