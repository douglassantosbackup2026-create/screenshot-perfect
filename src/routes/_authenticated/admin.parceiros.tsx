import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { pageHead } from "@/lib/seo";
import { requireModule } from "@/lib/admin/modules";
import { suggestCode } from "@/lib/affiliates/ref";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDate } from "@/lib/labels";
import { formatMoney } from "@/lib/calc/format";
import {
  commissionFor,
  DEFAULT_RULE,
  describeRule,
  formatRate,
  MODE_LABEL,
  parseRate,
  type CommissionMode,
  type CommissionRule,
} from "@/lib/calc/commission";
import { PLAN_NAMES } from "@/lib/billing/catalog";
import { usePlanPrices } from "@/lib/billing/prices";
import { errMsg } from "@/lib/errors";
import { useStaff } from "@/components/admin/hooks";

export const Route = createFileRoute("/_authenticated/admin/parceiros")({
  beforeLoad: ({ context }) => requireModule(context.staff, "/admin/parceiros"),
  head: () => pageHead("Admin de parceiros", "Inscrições, aprovação e comissões de parceiros.", "Inscrições e comissões de parceiros."),
  component: AdminAffiliates,
});

type Affiliate = {
  id: string;
  name: string;
  email: string;
  whatsapp: string;
  instagram: string;
  pix_key: string;
  message: string;
  status: "pendente" | "aprovado" | "recusado" | "suspenso";
  code: string | null;
  commission_mode: CommissionMode;
  commission_bp: number;
  commission_months: number | null;
  review_note: string;
  created_at: string;
  reviewed_at: string | null;
  referrals: number;
  pending_cents: number;
  paid_cents: number;
  coupons?: string[];
  manager_id: string | null;
};
type Manager = { id: string; name: string; email: string; whatsapp: string; pix_key: string; commission_bp: number; code: string; active: boolean; partners: number; pending_cents: number; paid_cents: number };
type Commission = {
  id: string;
  kind: "parceiro" | "gerente";
  affiliate_id: string;
  affiliate_name: string;
  pix_key: string;
  referred_email: string | null;
  payment_cents: number;
  commission_cents: number;
  status: string;
  created_at: string;
  paid_at: string | null;
};

const STATUS_LABEL: Record<Affiliate["status"], string> = { pendente: "Pendente", aprovado: "Aprovado", recusado: "Recusado", suspenso: "Suspenso" };
const day = (iso: string | null) => (iso ? formatDate(iso) : "—");
const ruleOf = (a: Affiliate): CommissionRule => ({ mode: a.commission_mode, bp: a.commission_bp, months: a.commission_months });

function AdminAffiliates() {
  const [rows, setRows] = useState<Affiliate[] | null>(null);
  const [editing, setEditing] = useState<Affiliate | null>(null);
  const [managers, setManagers] = useState<Manager[] | null>(null);

  const load = useCallback(async () => {
    const [{ data, error }, coupons, mgr] = await Promise.all([
      supabase.rpc("admin_list_affiliates", { p_status: null as unknown as string }),
      supabase.rpc("admin_list_coupons"),
      supabase.rpc("admin_list_managers"),
    ]);
    setManagers((mgr.data ?? []) as unknown as Manager[]);
    if (error) return void toast.error(errMsg(error));
    // Cupons de cada parceiro, só para mostrar no cartão (o cadastro é em Admin: cupons).
    const byAffiliate = new Map<string, string[]>();
    for (const c of (coupons.data ?? []) as unknown as { code: string; affiliate_id: string | null; active: boolean }[])
      if (c.affiliate_id && c.active) byAffiliate.set(c.affiliate_id, [...(byAffiliate.get(c.affiliate_id) ?? []), c.code]);
    setRows((data as unknown as Affiliate[]).map((a) => ({ ...a, coupons: byAffiliate.get(a.id) ?? [] })));
  }, []);
  useEffect(() => void load(), [load]);

  const by = (...s: Affiliate["status"][]) => rows?.filter((r) => s.includes(r.status)) ?? [];
  const pending = by("pendente");

  return (
    <div className="w-full max-w-3xl">
      <h1>Parceiros</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Acesso só para administradores. A inscrição é pública em /parceiros; o parceiro vê o painel entrando com o mesmo e-mail.
      </p>
      <Tabs defaultValue="pendentes" className="mt-6">
        {/* No celular, as quatro abas quebram em duas linhas em vez de passar da tela. */}
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="pendentes">Pendentes{pending.length ? ` (${pending.length})` : ""}</TabsTrigger>
          <TabsTrigger value="aprovados">Aprovados</TabsTrigger>
          <TabsTrigger value="recusados">Recusados</TabsTrigger>
          <TabsTrigger value="gerentes">Gerentes</TabsTrigger>
          <TabsTrigger value="comissoes">Comissões</TabsTrigger>
        </TabsList>
        <TabsContent value="pendentes">
          <AffiliateList rows={rows && pending} empty="Nenhuma inscrição esperando." onEdit={setEditing} onChanged={load} managers={managers ?? []} />
        </TabsContent>
        <TabsContent value="aprovados">
          <AffiliateList rows={rows && by("aprovado", "suspenso")} empty="Nenhum parceiro aprovado ainda." onEdit={setEditing} onChanged={load} managers={managers ?? []} />
        </TabsContent>
        <TabsContent value="recusados">
          <AffiliateList rows={rows && by("recusado")} empty="Nenhuma inscrição recusada." onEdit={setEditing} onChanged={load} managers={managers ?? []} />
        </TabsContent>
        <TabsContent value="gerentes">
          <Managers rows={managers} onChanged={load} />
        </TabsContent>
        <TabsContent value="comissoes">
          <Commissions onChanged={load} />
        </TabsContent>
      </Tabs>
      {editing && <ReviewDialog affiliate={editing} onClose={() => setEditing(null)} onSaved={load} />}
    </div>
  );
}

function AffiliateList({
  rows,
  empty,
  onEdit,
  onChanged,
  managers,
}: {
  rows: Affiliate[] | null;
  empty: string;
  onEdit: (a: Affiliate) => void;
  onChanged: () => void;
  managers: Manager[];
}) {
  if (!rows) return <div className="mt-4 h-36 animate-pulse rounded-2xl bg-card" aria-busy="true" />;
  if (!rows.length) return <p className="mt-4 text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="mt-4 space-y-4">
      {rows.map((a) => (
        <AffiliateCard key={a.id} a={a} onEdit={() => onEdit(a)} onChanged={onChanged} managers={managers} />
      ))}
    </ul>
  );
}

function AffiliateCard({ a, onEdit, onChanged, managers }: { a: Affiliate; onEdit: () => void; onChanged: () => void; managers: Manager[] }) {
  const [busy, setBusy] = useState(false);

  async function setManager(id: string) {
    setBusy(true);
    const { error } = await supabase.rpc("admin_set_affiliate_manager", { p_affiliate: a.id, p_manager: (id === "none" ? null : id) as unknown as string });
    setBusy(false);
    if (error) return void toast.error(errMsg(error));
    toast.success("Gerente atualizado.");
    onChanged();
  }

  async function setStatus(status: "aprovado" | "suspenso") {
    setBusy(true);
    const { error } = await supabase.rpc("admin_set_affiliate_status", { p_id: a.id, p_status: status });
    setBusy(false);
    if (error) return void toast.error(errMsg(error));
    toast.success(status === "suspenso" ? "Parceiro suspenso." : "Parceiro reativado.");
    onChanged();
  }

  return (
    <li className="rounded-2xl bg-card p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold">{a.name}</p>
          <p className="break-all text-xs text-muted-foreground">
            {a.email} · inscrito em {day(a.created_at)}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs">{STATUS_LABEL[a.status]}</span>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">WhatsApp</dt>
        <dd className="break-all">{a.whatsapp || "—"}</dd>
        <dt className="text-muted-foreground">Rede</dt>
        <dd className="break-all">{a.instagram || "—"}</dd>
        <dt className="text-muted-foreground">Pix</dt>
        <dd className="break-all">{a.pix_key || "—"}</dd>
        {a.code && (
          <>
            <dt className="text-muted-foreground">Código</dt>
            <dd className="money">{a.code}</dd>
            <dt className="text-muted-foreground">Regra</dt>
            <dd>{describeRule(ruleOf(a))}</dd>
            <dt className="text-muted-foreground">Indicados</dt>
            <dd className="money">{a.referrals}</dd>
            <dt className="text-muted-foreground">A pagar / pago</dt>
            <dd className="money">
              {formatMoney(a.pending_cents)} / {formatMoney(a.paid_cents)}
            </dd>
            <dt className="text-muted-foreground">Cupons</dt>
            <dd className="money">{a.coupons?.length ? a.coupons.join(", ") : "—"}</dd>
          </>
        )}
        {a.status === "recusado" && a.review_note && (
          <>
            <dt className="text-muted-foreground">Motivo</dt>
            <dd>{a.review_note}</dd>
          </>
        )}
      </dl>
      <div className="mt-3 flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Gerente</span>
        <Select value={a.manager_id ?? "none"} onValueChange={setManager} disabled={busy}>
          <SelectTrigger className="h-9 w-52 rounded-xl bg-muted" aria-label="Gerente do parceiro">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Nenhum</SelectItem>
            {managers.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {a.message && <p className="mt-3 whitespace-pre-line rounded-xl bg-muted p-3 text-sm">{a.message}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        {a.status === "pendente" && (
          <Button size="sm" disabled={busy} onClick={onEdit}>
            Analisar
          </Button>
        )}
        {a.status === "recusado" && (
          <Button size="sm" variant="outline" disabled={busy} onClick={onEdit}>
            Reconsiderar
          </Button>
        )}
        {(a.status === "aprovado" || a.status === "suspenso") && (
          <Button size="sm" variant="outline" disabled={busy} onClick={onEdit}>
            Editar regra
          </Button>
        )}
        {a.status === "aprovado" && (
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => setStatus("suspenso")}>
            Suspender
          </Button>
        )}
        {a.status === "suspenso" && (
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => setStatus("aprovado")}>
            Reativar
          </Button>
        )}
      </div>
    </li>
  );
}

function ReviewDialog({ affiliate: a, onClose, onSaved }: { affiliate: Affiliate; onClose: () => void; onSaved: () => void }) {
  const initial = a.code ? ruleOf(a) : DEFAULT_RULE;
  const [code, setCode] = useState(a.code ?? suggestCode(a.name));
  const [mode, setMode] = useState<CommissionMode>(initial.mode);
  const [rate, setRate] = useState(String(initial.bp / 100).replace(".", ","));
  const [months, setMonths] = useState(String(initial.months ?? 12));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const bp = parseRate(rate);
  const m = Number(months);
  const monthsOk = mode !== "meses" || (Number.isInteger(m) && m >= 1 && m <= 120);
  const codeOk = /^[A-Z0-9]{4,20}$/.test(code);
  const { prices } = usePlanPrices();
  const price = prices.inteligencia.mensal ?? 0;
  const now = new Date().toISOString();
  const sample = bp === null ? null : commissionFor({ mode, bp, months: m }, { paymentCents: price, paidAt: now, firstPaidAt: now, previousCount: 0 });

  async function decide(decision: "aprovar" | "recusar") {
    if (decision === "aprovar" && (!codeOk || bp === null || !monthsOk))
      return void toast.error("Confira o código (4 a 20 letras ou números), o percentual (0 a 100) e os meses (1 a 120).");
    setBusy(true);
    const { error } = await supabase.rpc("admin_review_affiliate", {
      p_id: a.id,
      p_decision: decision,
      p_code: code,
      p_mode: mode,
      p_bp: bp ?? 0,
      p_months: m || 12,
      p_note: note.trim(),
    });
    setBusy(false);
    if (error) return void toast.error(errMsg(error));
    toast.success(decision === "aprovar" ? (a.status === "pendente" ? "Parceiro aprovado." : "Regra salva.") : "Inscrição recusada.");
    onSaved();
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{a.name}</DialogTitle>
          <DialogDescription>Defina o código e a comissão. Mudanças na regra valem para os próximos pagamentos.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="aff-code" className="text-sm font-semibold">
              Código
            </label>
            <Input id="aff-code" className="h-11 uppercase" maxLength={20} value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} />
          </div>
          <div className="space-y-1.5">
            <span className="text-sm font-semibold">Regra</span>
            <Select value={mode} onValueChange={(v) => setMode(v as CommissionMode)}>
              <SelectTrigger className="h-11 rounded-xl bg-muted" aria-label="Regra da comissão">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(MODE_LABEL) as CommissionMode[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {MODE_LABEL[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="aff-rate" className="text-sm font-semibold">
                Comissão (%)
              </label>
              <Input id="aff-rate" className="h-11" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
            </div>
            {mode === "meses" && (
              <div className="space-y-1.5">
                <label htmlFor="aff-months" className="text-sm font-semibold">
                  Meses
                </label>
                <Input id="aff-months" className="h-11" inputMode="numeric" value={months} onChange={(e) => setMonths(e.target.value.replace(/\D/g, ""))} />
              </div>
            )}
          </div>
          {bp !== null && monthsOk && (
            <p className="rounded-xl bg-muted p-3 text-sm">
              {describeRule({ mode, bp, months: m })}. Ex.: {PLAN_NAMES.inteligencia} mensal de {formatMoney(price)} →{" "}
              <span className="money text-primary">{formatMoney(sample ?? 0)}</span> ({formatRate(bp)}).
            </p>
          )}
          {a.status === "pendente" && (
            <div className="space-y-1.5">
              <label htmlFor="aff-note" className="text-sm font-semibold">
                Motivo, se recusar (o candidato vê)
              </label>
              <Input id="aff-note" className="h-11" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          {a.status === "pendente" && (
            <Button variant="outline" disabled={busy} onClick={() => decide("recusar")}>
              Recusar
            </Button>
          )}
          <Button disabled={busy} onClick={() => decide("aprovar")}>
            {a.status === "pendente" || a.status === "recusado" ? "Aprovar" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Commissions({ onChanged }: { onChanged: () => void }) {
  const [status, setStatus] = useState<"pendente" | "paga" | "cancelada">("pendente");
  const [rows, setRows] = useState<Commission[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  // Pagar ou cancelar comissão é só do financeiro (o banco recusa os demais); marketing só consulta.
  const staff = useStaff();
  const canPay = staff.includes("super_admin") || staff.includes("financeiro");
  const selectable = canPay && status === "pendente";

  const load = useCallback(async () => {
    setRows(null);
    setSelected(new Set());
    const { data, error } = await supabase.rpc("admin_affiliate_commissions", { p_status: status });
    if (error) return void toast.error(errMsg(error));
    setRows(data as unknown as Commission[]);
  }, [status]);
  useEffect(() => void load(), [load]);

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  async function apply(to: "paga" | "cancelada") {
    setBusy(true);
    const { data, error } = await supabase.rpc("admin_set_commission_status", { p_ids: [...selected], p_status: to });
    setBusy(false);
    if (error) return void toast.error(errMsg(error));
    toast.success(`${data} ${to === "paga" ? "marcada(s) como paga(s)" : "cancelada(s)"}.`);
    void load();
    onChanged();
  }

  // Agrupado por parceiro: o total de cada um é o Pix a fazer.
  const groups = new Map<string, { first: Commission; list: Commission[] }>();
  for (const c of rows ?? []) {
    const key = `${c.kind}:${c.affiliate_id}`;
    const g = groups.get(key);
    if (g) g.list.push(c);
    else groups.set(key, { first: c, list: [c] });
  }

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
          <SelectTrigger className="h-11 w-44 rounded-xl bg-muted" aria-label="Situação">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pendente">A pagar</SelectItem>
            <SelectItem value="paga">Pagas</SelectItem>
            <SelectItem value="cancelada">Canceladas</SelectItem>
          </SelectContent>
        </Select>
        {selectable && (
          <>
            <Button size="sm" disabled={busy || !selected.size} onClick={() => apply("paga")}>
              Marcar como pagas ({selected.size})
            </Button>
            <Button size="sm" variant="ghost" disabled={busy || !selected.size} onClick={() => apply("cancelada")}>
              Cancelar
            </Button>
          </>
        )}
      </div>
      {!rows && <div className="mt-4 h-36 animate-pulse rounded-2xl bg-card" aria-busy="true" />}
      {rows && !rows.length && <p className="mt-4 text-sm text-muted-foreground">Nenhuma comissão aqui.</p>}
      <ul className="mt-4 space-y-4">
        {[...groups.values()].map(({ first, list }) => {
          const ids = list.map((c) => c.id);
          const all = ids.every((id) => selected.has(id));
          return (
            <li key={`${first.kind}:${first.affiliate_id}`} className="rounded-2xl bg-card p-4 shadow-card">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {first.affiliate_name}
                    {first.kind === "gerente" && <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-normal">Gerente</span>}
                  </p>
                  <p className="break-all text-xs text-muted-foreground">Pix: {first.pix_key || "não informado"}</p>
                </div>
                <span className="money shrink-0 text-primary">{formatMoney(list.reduce((t, c) => t + c.commission_cents, 0))}</span>
              </div>
              {selectable && (
                <label className="mt-3 flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={all}
                    onCheckedChange={(v) =>
                      setSelected((s) => {
                        const n = new Set(s);
                        for (const id of ids) {
                          if (v === true) n.add(id);
                          else n.delete(id);
                        }
                        return n;
                      })
                    }
                  />
                  Selecionar todas deste parceiro
                </label>
              )}
              <ul className="mt-2 divide-y divide-border text-sm">
                {list.map((c) => (
                  <li key={c.id} className="flex items-center gap-2 py-2">
                    {selectable && (
                      <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggle(c.id)} aria-label="Selecionar comissão" />
                    )}
                    <span className="min-w-0 flex-1 truncate">
                      {day(c.created_at)} · {c.referred_email ?? "conta excluída"} · pagou {formatMoney(c.payment_cents)}
                    </span>
                    <span className="money">{formatMoney(c.commission_cents)}</span>
                  </li>
                ))}
              </ul>
              {status === "paga" && (
                <p className="mt-2 text-xs text-muted-foreground">Última paga em {day(list.reduce((t: string | null, c) => (c.paid_at && (!t || c.paid_at > t) ? c.paid_at : t), null))}</p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Managers({ rows, onChanged }: { rows: Manager[] | null; onChanged: () => void }) {
  const [editing, setEditing] = useState<Manager | "new" | null>(null);
  if (!rows) return <div className="mt-4 h-36 animate-pulse rounded-2xl bg-card" aria-busy="true" />;
  return (
    <div className="mt-4">
      <Button size="sm" onClick={() => setEditing("new")}>
        Novo gerente
      </Button>
      {!rows.length && <p className="mt-4 text-sm text-muted-foreground">Nenhum gerente ainda.</p>}
      <ul className="mt-4 space-y-4">
        {rows.map((m) => (
          <li key={m.id} className="rounded-2xl bg-card p-4 shadow-card">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold">{m.name}</p>
                <p className="break-all text-xs text-muted-foreground">{m.email}</p>
              </div>
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs">{m.active ? "Ativo" : "Inativo"}</span>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Comissão extra</dt>
              <dd className="money">{formatRate(m.commission_bp)}</dd>
              <dt className="text-muted-foreground">Código de convite</dt>
              <dd className="money">{m.code}</dd>
              <dt className="text-muted-foreground">Parceiros</dt>
              <dd className="money">{m.partners}</dd>
              <dt className="text-muted-foreground">A pagar / pago</dt>
              <dd className="money">
                {formatMoney(m.pending_cents)} / {formatMoney(m.paid_cents)}
              </dd>
              <dt className="text-muted-foreground">Pix</dt>
              <dd className="break-all">{m.pix_key || "—"}</dd>
            </dl>
            <Button size="sm" variant="outline" className="mt-4" onClick={() => setEditing(m)}>
              Editar
            </Button>
          </li>
        ))}
      </ul>
      {editing && <ManagerDialog manager={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={onChanged} />}
    </div>
  );
}

function ManagerDialog({ manager: m, onClose, onSaved }: { manager: Manager | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    name: m?.name ?? "",
    email: m?.email ?? "",
    whatsapp: m?.whatsapp ?? "",
    pix_key: m?.pix_key ?? "",
    rate: m ? String(m.commission_bp / 100).replace(".", ",") : "5",
    code: m?.code ?? "",
    active: m?.active ?? true,
  });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((x) => ({ ...x, [k]: e.target.value }));

  async function save() {
    const bp = parseRate(f.rate);
    const code = f.code || suggestCode(f.name);
    if (f.name.trim().length < 2 || !/^\S+@\S+\.\S+$/.test(f.email.trim()) || bp === null || !/^[A-Z0-9]{4,20}$/.test(code))
      return void toast.error("Confira nome, e-mail, percentual (0 a 100) e código (4 a 20 letras ou números).");
    setBusy(true);
    const { error } = await supabase.rpc("admin_save_manager", {
      p_id: (m?.id ?? null) as unknown as string,
      p_manager: { name: f.name, email: f.email, whatsapp: f.whatsapp, pix_key: f.pix_key, commission_bp: bp, code, active: f.active },
    });
    setBusy(false);
    if (error) return void toast.error(error.code === "23505" ? "E-mail ou código já usado por outro gerente." : errMsg(error));
    toast.success("Gerente salvo.");
    onSaved();
    onClose();
  }

  const field = (id: keyof typeof f, label: string, extra?: React.InputHTMLAttributes<HTMLInputElement>) => (
    <div className="space-y-1.5">
      <label htmlFor={`mgr-${id}`} className="text-sm font-semibold">
        {label}
      </label>
      <Input id={`mgr-${id}`} className="h-11" value={String(f[id])} onChange={set(id)} {...extra} />
    </div>
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{m ? m.name : "Novo gerente"}</DialogTitle>
          <DialogDescription>O gerente entra no app com este e-mail e vê os parceiros dele em Perfil → Área do gerente.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {field("name", "Nome", { maxLength: 120 })}
          {field("email", "E-mail", { type: "email", maxLength: 254 })}
          {field("whatsapp", "WhatsApp", { maxLength: 30 })}
          {field("pix_key", "Chave Pix", { maxLength: 140 })}
          <div className="grid grid-cols-2 gap-3">
            {field("rate", "Comissão extra (%)", { inputMode: "decimal" })}
            <div className="space-y-1.5">
              <label htmlFor="mgr-code" className="text-sm font-semibold">
                Código de convite
              </label>
              <Input
                id="mgr-code"
                className="h-11 uppercase"
                maxLength={20}
                placeholder={suggestCode(f.name || "GERENTE")}
                value={f.code}
                onChange={(e) => setF((x) => ({ ...x, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") }))}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={f.active} onCheckedChange={(v) => setF((x) => ({ ...x, active: v === true }))} />
            Ativo (inativo para de ganhar comissões novas)
          </label>
        </div>
        <DialogFooter>
          <Button disabled={busy} onClick={save}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
