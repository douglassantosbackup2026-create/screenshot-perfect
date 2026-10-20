import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { BookOpen, Check, Lock, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlacementQuiz } from "@/components/PlacementQuiz";
import { UNITS } from "@/content/journey";
import { canTakePlacement, lessonOf, unitProgress, type JourneyNode } from "@/lib/journey/journey";
import { cn } from "@/lib/utils";

// Deslocamento horizontal de cada nó, em zigue-zague, como uma trilha.
const OFFSETS = [0, 44, 64, 44, 0, -44, -64, -44];

/** Mapa da jornada: unidades em sequência, lições concluídas, atual, abertas e bloqueadas. */
export function JourneyMap({ nodes, completed, testedOut }: { nodes: JourneyNode[]; completed: number[]; testedOut: number[] }) {
  const [placement, setPlacement] = useState<number | null>(null);

  return (
    <div className="space-y-10">
      {UNITS.map((u) => {
        const prog = unitProgress(u, completed);
        const unitNodes = nodes.filter((n) => n.unit === u.n);
        const locked = unitNodes.every((n) => n.status === "locked");
        const tested = testedOut.includes(u.n);
        return (
          <section key={u.n} aria-label={`Unidade ${u.n}: ${u.title}`}>
            <header className={cn("rounded-2xl p-5 shadow-card", locked ? "bg-card/60" : "bg-card")}>
              <p className="eyebrow">
                Unidade {u.n}
                {u.tag ? ` · ${u.tag}` : ""}
              </p>
              <h3 className={cn("mt-1 text-xl", locked && "text-muted-foreground")}>{u.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{u.description}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-muted px-3 py-1">
                  {prog.done} de {prog.total} lições
                </span>
                <span className={cn("rounded-full px-3 py-1", prog.complete ? "bg-primary/15 font-semibold text-primary" : "bg-muted text-muted-foreground")}>
                  {prog.complete ? "Desbloqueado: " : "Ao concluir: "}
                  {u.result}
                </span>
                {tested && !prog.complete && <span className="rounded-full bg-muted px-3 py-1">Liberada no teste</span>}
              </div>
              {canTakePlacement(u.n, completed, testedOut) && (
                <Button variant="outline" size="sm" className="mt-4" onClick={() => setPlacement(u.n)}>
                  Já sabe isso? Fazer teste
                </Button>
              )}
            </header>

            <ol className="mt-6 flex flex-col items-center gap-5">
              {unitNodes.map((n, i) => (
                <li key={n.day} style={{ transform: `translateX(${OFFSETS[i % OFFSETS.length]}px)` }}>
                  <Node node={n} />
                </li>
              ))}
              <li style={{ transform: `translateX(${OFFSETS[unitNodes.length % OFFSETS.length]}px)` }}>
                <span
                  className={cn(
                    "flex h-14 w-14 items-center justify-center rounded-2xl",
                    prog.complete ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                  )}
                  aria-label={prog.complete ? `${u.result}: desbloqueado` : `${u.result}: ainda não`}
                  role="img"
                >
                  <Trophy size={24} strokeWidth={1.75} aria-hidden />
                </span>
              </li>
            </ol>
          </section>
        );
      })}
      <PlacementQuiz unit={placement} onClose={() => setPlacement(null)} />
    </div>
  );
}

function Node({ node }: { node: JourneyNode }) {
  const lesson = lessonOf(node.day)!;
  const label = `Lição ${node.indexInUnit} de ${node.unitSize}: ${lesson.title}`;
  const base = "flex h-16 w-16 items-center justify-center rounded-full transition-transform";

  if (node.status === "locked") {
    return (
      <span className={cn(base, "bg-muted text-muted-foreground")} role="img" aria-label={`${label} (bloqueada)`}>
        <Lock size={22} strokeWidth={1.75} aria-hidden />
      </span>
    );
  }

  return (
    <div className="relative flex flex-col items-center">
      {node.status === "current" && (
        <span className="absolute -top-9 whitespace-nowrap rounded-xl bg-card px-3 py-1 text-xs font-semibold text-primary shadow-card">
          Começar
        </span>
      )}
      <Link
        to="/programa/$dia"
        params={{ dia: String(node.day) }}
        aria-label={node.status === "done" ? `${label} (concluída)` : label}
        aria-current={node.status === "current" ? "step" : undefined}
        className={cn(
          base,
          "hover:scale-105",
          node.status === "done" && "bg-primary text-primary-foreground",
          node.status === "current" && "animate-pulse bg-primary text-primary-foreground ring-8 ring-primary/25 motion-reduce:animate-none",
          node.status === "available" && "bg-card text-primary shadow-card ring-2 ring-primary/50",
        )}
      >
        {node.status === "done" ? <Check size={26} strokeWidth={2.25} aria-hidden /> : <BookOpen size={24} strokeWidth={1.75} aria-hidden />}
      </Link>
      {node.status === "current" && <p className="mt-2 max-w-[200px] text-center text-sm font-semibold">{lesson.title}</p>}
    </div>
  );
}
