import { useEffect, useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { pageHead } from "@/lib/seo";
import { isAdmin } from "@/lib/auth/roles";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Segmented } from "@/components/forms";
import { PROGRAM, type ActionKey, type LessonQuestion } from "@/content/program";
import { publishBlockers, type ContentStatus } from "@/lib/content-rules";
import { deleteMission, loadContent, saveLesson, saveMissions, type EditLesson, type EditMission, type LoadedContent } from "@/lib/admin/content";
import { errMsg } from "@/lib/errors";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/conteudo")({
  beforeLoad: async () => {
    if (!(await isAdmin())) throw redirect({ to: "/hoje", replace: true });
  },
  head: () => pageHead("Admin de conteúdo", "Cadastro e revisão de lições, perguntas e missões semanais.", "Cadastro e revisão de lições, perguntas e missões."),
  component: Admin,
});

const STATUS_LABEL: Record<ContentStatus, string> = { rascunho: "Rascunho", revisada: "Revisada", publicada: "Publicada" };

function Admin() {
  const [loaded, setLoaded] = useState<LoadedContent | null>(null);
  const [failed, setFailed] = useState(false);
  const [lessons, setLessons] = useState<EditLesson[]>([]);
  const [missions, setMissions] = useState<EditMission[]>([]);
  // Dias com mudança ainda não salva (e as missões, que salvam juntas).
  const [dirty, setDirty] = useState<Set<number>>(new Set());
  const [missionsDirty, setMissionsDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sel, setSel] = useState<number | null>(null);

  useEffect(() => {
    loadContent()
      .then((c) => {
        setLoaded(c);
        setLessons(c.lessons);
        setMissions(c.missions);
      })
      .catch(() => setFailed(true));
  }, []);

  const lesson = sel != null ? (lessons.find((l) => l.day === sel) ?? null) : null;
  const update = (patch: Partial<EditLesson>) => {
    setLessons((ls) => ls.map((l) => (l.day === sel ? { ...l, ...patch } : l)));
    if (sel != null) setDirty((d) => new Set(d).add(sel));
  };

  async function run(task: () => Promise<void>, ok: string) {
    setBusy(true);
    try {
      await task();
      toast.success(ok);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  const saveOne = (l: EditLesson) =>
    run(async () => {
      await saveLesson(l);
      setDirty((d) => {
        const n = new Set(d);
        n.delete(l.day);
        return n;
      });
    }, `Dia ${l.day} salvo.`);

  const importAll = () =>
    run(async () => {
      for (const l of lessons) await saveLesson(l);
      await saveMissions(missions);
      setDirty(new Set());
      setMissionsDirty(false);
      setLoaded((c) => (c ? { ...c, fromDb: { lessons: true, missions: true } } : c));
    }, "Conteúdo do arquivo gravado no banco como rascunho.");

  const saveAllMissions = () =>
    run(async () => {
      await saveMissions(missions);
      setMissionsDirty(false);
      setLoaded((c) => (c ? { ...c, fromDb: { ...c.fromDb, missions: true } } : c));
    }, "Missões salvas.");

  if (failed) return <main className="mx-auto w-full max-w-[720px] px-5 pb-28 pt-8"><h1>Conteúdo</h1><p className="mt-2 text-sm text-muted-foreground">Não foi possível carregar o conteúdo do banco. Tente de novo em instantes.</p></main>;
  if (!loaded) return <main className="mx-auto w-full max-w-[720px] px-5 pb-28 pt-8"><h1>Conteúdo</h1><p className="mt-2 text-sm text-muted-foreground">Carregando…</p></main>;

  return (
    <main className="mx-auto w-full max-w-[720px] px-5 pb-28 pt-8">
      <h1>Conteúdo</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Acesso só para administradores. As mudanças ficam no banco; o app das pessoas ainda usa o texto do arquivo até a jornada voltar.
      </p>
      {!loaded.fromDb.lessons && (
        <div className="mt-4 rounded-2xl bg-card p-4 shadow-card">
          <p className="text-sm">O banco ainda não tem as lições. Grave as {lessons.length} lições e as missões do arquivo como rascunho para começar a revisão.</p>
          <Button className="mt-3" disabled={busy} onClick={importAll}>
            Importar do arquivo
          </Button>
        </div>
      )}

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
                        {dirty.has(l.day) && <span className="ml-2 text-xs text-primary">não salvo</span>}
                      </span>
                      <StatusChip status={l.status} />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            <LessonForm lesson={lesson} update={update} back={() => setSel(null)} dirty={dirty.has(lesson.day)} busy={busy} onSave={() => saveOne(lesson)} />
          )}
        </TabsContent>

        <TabsContent value="missoes">
          <MissionsEditor
            missions={missions}
            setMissions={(fn) => {
              setMissions(fn);
              setMissionsDirty(true);
            }}
            onDelete={(slug) => run(() => deleteMission(slug), "Missão excluída.")}
          />
          <Button className="mt-4 w-full" disabled={busy || !missionsDirty} onClick={saveAllMissions}>
            {missionsDirty ? "Salvar missões" : "Missões salvas"}
          </Button>
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

function LessonForm({
  lesson,
  update,
  back,
  dirty,
  busy,
  onSave,
}: {
  lesson: EditLesson;
  update: (p: Partial<EditLesson>) => void;
  back: () => void;
  dirty: boolean;
  busy: boolean;
  onSave: () => void;
}) {
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
      <Button className="w-full" disabled={busy || !dirty} onClick={onSave}>
        {dirty ? "Salvar lição" : "Lição salva"}
      </Button>
    </section>
  );
}

function MissionsEditor({
  missions,
  setMissions,
  onDelete,
}: {
  missions: EditMission[];
  setMissions: (fn: (m: EditMission[]) => EditMission[]) => void;
  onDelete: (slug: string) => void;
}) {
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
              <Button size="sm" variant="ghost" aria-label="Excluir missão" onClick={() => {
                  setMissions((ms) => ms.filter((x) => x.slug !== m.slug));
                  onDelete(m.slug);
                }}>
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
            { order: ms.length + 1, slug: `nova-${Date.now().toString(36)}`, title: "Nova missão", description: "", hint: "reflection", status: "rascunho" },
          ])
        }
      >
        <Plus strokeWidth={1.75} /> Nova missão
      </Button>
    </section>
  );
}
