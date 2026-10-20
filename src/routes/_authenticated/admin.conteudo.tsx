import { useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { getSession } from "@/lib/data/session";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Segmented } from "@/components/forms";
import { LESSONS, PROGRAM, type ActionKey, type LessonQuestion } from "@/content/program";
import { MISSIONS, type Mission } from "@/content/missions";
import { publishBlockers, type ContentStatus } from "@/lib/content-rules";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/conteudo")({
  // Com login, só quem tem o papel de admin (user_roles); no modo demonstração, edita só neste aparelho.
  beforeLoad: async () => {
    const session = await getSession();
    if (!session) return;
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id);
    if (!(data ?? []).some((r) => r.role === "admin")) throw redirect({ to: "/hoje" });
  },
  head: () => ({
    meta: [
      { title: "Admin de conteúdo — Previdência Intelligence" },
      { name: "description", content: "Cadastro e revisão de lições, perguntas e missões semanais." },
      { property: "og:title", content: "Admin de conteúdo — Previdência Intelligence" },
      { property: "og:description", content: "Cadastro e revisão de lições, perguntas e missões." },
    ],
  }),
  component: Admin,
});

type EditLesson = {
  day: number;
  title: string;
  objective: string;
  keyPoints: string[];
  bodyMd: string;
  actionKey: ActionKey | null;
  sources: { label: string; url: string }[];
  reviewedBy: string;
  reviewedAt: string;
  status: ContentStatus;
  questions: LessonQuestion[];
};
type EditMission = Mission & { status: ContentStatus };

const STATUS_LABEL: Record<ContentStatus, string> = { rascunho: "Rascunho", revisada: "Revisada", publicada: "Publicada" };

function Admin() {
  const [lessons, setLessons] = useState<EditLesson[]>(() =>
    LESSONS.map((l) => ({
      day: l.day,
      title: l.title,
      objective: l.objective,
      keyPoints: [...l.keyPoints],
      bodyMd: "",
      actionKey: l.actionKey,
      sources: l.sources.map((s) => ({ ...s })),
      reviewedBy: "",
      reviewedAt: "",
      status: "rascunho",
      questions: l.questions.map((q) => ({ ...q, options: q.options.map((o) => ({ ...o })) })),
    })),
  );
  const [missions, setMissions] = useState<EditMission[]>(() => MISSIONS.map((m) => ({ ...m, status: "rascunho" })));
  const [sel, setSel] = useState<number | null>(null);

  const lesson = sel != null ? lessons.find((l) => l.day === sel)! : null;
  const update = (patch: Partial<EditLesson>) => setLessons((ls) => ls.map((l) => (l.day === sel ? { ...l, ...patch } : l)));

  return (
    <main className="mx-auto w-full max-w-[720px] px-5 pb-28 pt-8">
      <h1>Conteúdo</h1>
      <p className="mt-2 text-sm text-muted-foreground">Acesso só para administradores. Em modo demonstração, as mudanças não são salvas.</p>

      <Tabs defaultValue="licoes" className="mt-6">
        <TabsList>
          <TabsTrigger value="licoes">Lições</TabsTrigger>
          <TabsTrigger value="missoes">Missões</TabsTrigger>
        </TabsList>

        <TabsContent value="licoes">
          {!lesson ? (
            <section className="mt-4">
              <h2 className="text-lg">{PROGRAM.title}</h2>
              <ul className="mt-3 divide-y divide-border rounded-2xl bg-card shadow-card">
                {lessons.map((l) => (
                  <li key={l.day}>
                    <button type="button" onClick={() => setSel(l.day)} className="flex min-h-12 w-full items-center justify-between gap-3 px-4 text-left hover:bg-muted">
                      <span>
                        <span className="text-muted-foreground">Dia {l.day} · </span>
                        {l.title}
                      </span>
                      <StatusChip status={l.status} />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            <LessonForm lesson={lesson} update={update} back={() => setSel(null)} />
          )}
        </TabsContent>

        <TabsContent value="missoes">
          <MissionsEditor missions={missions} setMissions={setMissions} />
        </TabsContent>
      </Tabs>
    </main>
  );
}

function StatusChip({ status }: { status: ContentStatus }) {
  return (
    <span className={cn("shrink-0 rounded-full border px-2.5 py-0.5 text-xs", status === "publicada" ? "border-primary text-primary" : "border-border text-muted-foreground")}>
      {STATUS_LABEL[status]}
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function LessonForm({ lesson, update, back }: { lesson: EditLesson; update: (p: Partial<EditLesson>) => void; back: () => void }) {
  const [preview, setPreview] = useState(false);
  const blockers = publishBlockers({ reviewedBy: lesson.reviewedBy, reviewedAt: lesson.reviewedAt || null, sources: lesson.sources });

  function setStatus(s: ContentStatus) {
    if (s === "publicada" && blockers.length) {
      toast.error(blockers.join(" "));
      return;
    }
    update({ status: s });
  }
  const setQ = (i: number, patch: Partial<LessonQuestion>) => update({ questions: lesson.questions.map((q, j) => (j === i ? { ...q, ...patch } : q)) });

  return (
    <section className="mt-4 space-y-5">
      <Button variant="ghost" size="sm" onClick={back}>
        ← Todas as lições
      </Button>
      <h2>Dia {lesson.day}</h2>

      <Field label="Título">
        <Input value={lesson.title} onChange={(e) => update({ title: e.target.value })} />
      </Field>
      <Field label="Objetivo">
        <Input value={lesson.objective} onChange={(e) => update({ objective: e.target.value })} />
      </Field>
      <div>
        <p className="text-sm font-semibold">Pontos-chave</p>
        <div className="mt-1.5 space-y-2">
          {lesson.keyPoints.map((k, i) => (
            <div key={i} className="flex gap-2">
              <Textarea value={k} aria-label={`Ponto ${i + 1}`} onChange={(e) => update({ keyPoints: lesson.keyPoints.map((x, j) => (j === i ? e.target.value : x)) })} />
              <Button variant="ghost" size="icon" aria-label="Remover ponto" onClick={() => update({ keyPoints: lesson.keyPoints.filter((_, j) => j !== i) })}>
                <Trash2 strokeWidth={1.75} />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => update({ keyPoints: [...lesson.keyPoints, ""] })}>
            <Plus strokeWidth={1.75} /> Ponto-chave
          </Button>
        </div>
      </div>
      <Field label="Corpo em markdown (opcional)">
        <Textarea rows={5} value={lesson.bodyMd} onChange={(e) => update({ bodyMd: e.target.value })} />
      </Field>
      <div>
        <p className="text-sm font-semibold">Ação do dia</p>
        <div className="mt-1.5">
          <Segmented
            label="Ação do dia"
            value={lesson.actionKey ?? "none"}
            onChange={(v) => update({ actionKey: v === "none" ? null : (v as ActionKey) })}
            options={[
              { value: "none", label: "Nenhuma" },
              { value: "set_goal", label: "Meta" },
              { value: "create_plan", label: "Plano" },
              { value: "first_contribution", label: "Aporte" },
            ]}
          />
        </div>
      </div>
      <div>
        <p className="text-sm font-semibold">Fontes</p>
        <div className="mt-1.5 space-y-2">
          {lesson.sources.map((s, i) => (
            <div key={i} className="flex gap-2">
              <Input placeholder="Rótulo" aria-label="Rótulo da fonte" value={s.label} onChange={(e) => update({ sources: lesson.sources.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
              <Input placeholder="https://" aria-label="URL da fonte" value={s.url} onChange={(e) => update({ sources: lesson.sources.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) })} />
              <Button variant="ghost" size="icon" aria-label="Remover fonte" onClick={() => update({ sources: lesson.sources.filter((_, j) => j !== i) })}>
                <Trash2 strokeWidth={1.75} />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => update({ sources: [...lesson.sources, { label: "", url: "" }] })}>
            <Plus strokeWidth={1.75} /> Fonte
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Revisado por">
          <Input value={lesson.reviewedBy} onChange={(e) => update({ reviewedBy: e.target.value })} />
        </Field>
        <Field label="Revisado em">
          <Input type="date" value={lesson.reviewedAt} onChange={(e) => update({ reviewedAt: e.target.value })} />
        </Field>
      </div>

      <div className="flex items-center justify-between">
        <h3>Perguntas</h3>
        <Button variant="outline" size="sm" onClick={() => setPreview((p) => !p)}>
          {preview ? "Editar" : "Pré-visualizar"}
        </Button>
      </div>
      {lesson.questions.map((q, i) =>
        preview ? (
          <div key={i} className="rounded-2xl bg-card shadow-card p-4">
            <p className="text-sm text-muted-foreground">Pergunta {i + 1}</p>
            <p className="mt-1 font-semibold">{q.prompt}</p>
            <ul className="mt-3 grid gap-2">
              {q.options.map((o) => (
                <li key={o.id} className={cn("rounded-xl border px-3 py-2", o.id === q.correct ? "border-primary text-primary" : "border-border")}>
                  {o.text}
                </li>
              ))}
            </ul>
            {q.explanation && <p className="mt-2 text-sm text-muted-foreground">{q.explanation}</p>}
          </div>
        ) : (
          <div key={i} className="space-y-2 rounded-2xl bg-card shadow-card p-4">
            <Field label={`Pergunta ${i + 1}`}>
              <Input value={q.prompt} onChange={(e) => setQ(i, { prompt: e.target.value })} />
            </Field>
            {q.options.map((o, oi) => (
              <div key={o.id} className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`correct-${i}`}
                  aria-label={`Opção ${o.id} é a correta`}
                  checked={q.correct === o.id}
                  onChange={() => setQ(i, { correct: o.id })}
                  className="h-5 w-5 accent-[var(--primary)]"
                />
                <Input value={o.text} aria-label={`Opção ${o.id}`} onChange={(e) => setQ(i, { options: q.options.map((x, j) => (j === oi ? { ...x, text: e.target.value } : x)) })} />
              </div>
            ))}
            <Field label="Explicação">
              <Textarea value={q.explanation} onChange={(e) => setQ(i, { explanation: e.target.value })} />
            </Field>
          </div>
        ),
      )}

      <div className="rounded-2xl bg-card shadow-card p-4">
        <p className="text-sm font-semibold">Status</p>
        <div className="mt-2">
          <Segmented
            label="Status"
            value={lesson.status}
            onChange={setStatus}
            options={(["rascunho", "revisada", "publicada"] as ContentStatus[]).map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
          />
        </div>
        {blockers.length > 0 && <p className="mt-2 text-sm text-muted-foreground">Para publicar: {blockers.join(" ")}</p>}
      </div>
    </section>
  );
}

function MissionsEditor({ missions, setMissions }: { missions: EditMission[]; setMissions: (fn: (m: EditMission[]) => EditMission[]) => void }) {
  const upd = (slug: string, patch: Partial<EditMission>) => setMissions((ms) => ms.map((m) => (m.slug === slug ? { ...m, ...patch } : m)));
  return (
    <section className="mt-4 space-y-3">
      {missions
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((m) => (
          <div key={m.slug} className="space-y-2 rounded-2xl bg-card shadow-card p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-muted-foreground">Ordem {m.order}</span>
              <StatusChip status={m.status} />
            </div>
            <Input aria-label="Título" value={m.title} onChange={(e) => upd(m.slug, { title: e.target.value })} />
            <Textarea aria-label="Descrição" value={m.description} onChange={(e) => upd(m.slug, { description: e.target.value })} />
            <div className="flex flex-wrap gap-2">
              {(["rascunho", "revisada", "publicada"] as ContentStatus[]).map((s) => (
                <Button key={s} size="sm" variant={m.status === s ? "default" : "outline"} onClick={() => upd(m.slug, { status: s })}>
                  {STATUS_LABEL[s]}
                </Button>
              ))}
              <Button size="sm" variant="ghost" aria-label="Excluir missão" onClick={() => setMissions((ms) => ms.filter((x) => x.slug !== m.slug))}>
                <Trash2 strokeWidth={1.75} />
              </Button>
            </div>
          </div>
        ))}
      <Button
        variant="outline"
        onClick={() =>
          setMissions((ms) => [
            ...ms,
            { order: ms.length + 1, slug: `nova-${ms.length + 1}`, title: "Nova missão", description: "", hint: "reflection", status: "rascunho" },
          ])
        }
      >
        <Plus strokeWidth={1.75} /> Nova missão
      </Button>
    </section>
  );
}
