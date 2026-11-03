// Painel → Usuários → Novo cadastro (só super admin): cria a conta com senha temporária e as opções escolhidas
// (perfil da equipe, cortesia ou link de assinatura, afiliado). Depois mostra senha e link uma vez, para copiar.
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "@/components/auth/AuthShell";
import { adminCreateUser } from "@/lib/admin/panel.functions";
import { ROLE_HINT, ROLE_LABEL, type StaffRole } from "@/lib/admin/modules";
import { generatePassword, passwordProblems } from "@/lib/auth/password";
import { commissionFor, DEFAULT_RULE, describeRule, MODE_LABEL, parseRate, type CommissionMode } from "@/lib/calc/commission";
import { suggestCode } from "@/lib/affiliates/ref";
import { formatMoney } from "@/lib/calc/format";
import { errMsg } from "@/lib/errors";
import { cn } from "@/lib/utils";

type Access = "nenhum" | "cortesia" | "assinatura";
const COMMON = "comum";
const ROLES = Object.keys(ROLE_LABEL) as StaffRole[];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-3 rounded-xl bg-muted/50 p-3">
      <legend className="px-1 text-sm font-semibold">{title}</legend>
      {children}
    </fieldset>
  );
}

function Choice<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn("min-h-11 rounded-full border px-4 text-sm", value === o.value ? "border-primary font-semibold text-primary" : "border-border")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

async function copy(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${what} copiado.`);
  } catch {
    toast.error("Não foi possível copiar. Selecione e copie.");
  }
}

export function NewUserDialog({ open, onClose, onCreated, monthlyPriceCents }: { open: boolean; onClose: () => void; onCreated: () => void; monthlyPriceCents: number }) {
  const create = useServerFn(adminCreateUser);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(() => generatePassword());
  const [role, setRole] = useState<string>(COMMON);
  const [access, setAccess] = useState<Access>("nenhum");
  const [months, setMonths] = useState("3");
  const [reason, setReason] = useState("");
  const [period, setPeriod] = useState<"mensal" | "anual">("mensal");
  const [isAffiliate, setIsAffiliate] = useState(false);
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<CommissionMode>(DEFAULT_RULE.mode);
  const [rate, setRate] = useState(String(DEFAULT_RULE.bp / 100));
  const [ruleMonths, setRuleMonths] = useState(String(DEFAULT_RULE.months));
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ email: string; password: string; link: string | null; warnings: string[] } | null>(null);

  const bp = parseRate(rate);
  const rm = Number(ruleMonths);
  const affiliateCode = (code || suggestCode(name)).toUpperCase();
  const problems = [
    name.trim().length < 2 && "Informe o nome.",
    !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()) && "Informe um e-mail válido.",
    passwordProblems(password)[0],
    isAffiliate && !/^[A-Z0-9]{4,20}$/.test(affiliateCode) && "Código de afiliado: 4 a 20 letras ou números.",
    isAffiliate && bp === null && "Comissão: use um percentual entre 0 e 100.",
    isAffiliate && mode === "meses" && !(Number.isInteger(rm) && rm >= 1 && rm <= 120) && "Meses da comissão: de 1 a 120.",
  ].filter(Boolean) as string[];

  function reset() {
    setName("");
    setEmail("");
    setPassword(generatePassword());
    setRole(COMMON);
    setAccess("nenhum");
    setReason("");
    setIsAffiliate(false);
    setCode("");
    setDone(null);
  }

  async function submit() {
    if (problems.length) return void toast.error(problems[0]);
    setBusy(true);
    try {
      const r = await create({
        data: {
          name: name.trim(),
          email: email.trim(),
          password,
          staffRole: role === COMMON ? null : (role as StaffRole),
          courtesyMonths: access === "cortesia" ? Number(months) : null,
          courtesyReason: reason.trim(),
          subscription: access === "assinatura" ? period : null,
          affiliate: isAffiliate ? { code: affiliateCode, mode, bp: bp ?? 0, months: mode === "meses" ? rm : null } : null,
        },
      });
      if (r.error) return void toast.error(r.error);
      setDone({ email: email.trim().toLowerCase(), password, link: r.link, warnings: r.warnings });
      onCreated();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{done ? "Conta criada" : "Novo cadastro"}</DialogTitle>
          <DialogDescription>
            {done
              ? "Passe estes dados para a pessoa. A senha não fica guardada no painel: copie agora."
              : "A conta já nasce confirmada. No primeiro acesso, a pessoa precisa trocar a senha temporária."}
          </DialogDescription>
        </DialogHeader>

        {done ? (
          <div className="space-y-3 text-sm">
            {(
              [
                ["E-mail", done.email],
                ["Senha temporária", done.password],
                ...(done.link ? [["Link de assinatura", done.link]] : []),
              ] as [string, string][]
            ).map(([label, value]) => (
              <div key={label}>
                <p className="text-xs text-muted-foreground">{label}</p>
                <div className="mt-1 flex items-center gap-2 rounded-xl bg-muted p-2">
                  <code className="min-w-0 flex-1 break-all text-xs">{value}</code>
                  <Button size="icon" variant="ghost" aria-label={`Copiar ${label.toLowerCase()}`} onClick={() => copy(value, label)}>
                    <Copy size={16} />
                  </Button>
                </div>
              </div>
            ))}
            {done.warnings.length > 0 && (
              <ul role="alert" className="space-y-1 rounded-xl p-3 text-sm ring-1 ring-destructive">
                {done.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={reset}>
                Criar outro
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <Section title="Dados">
              <Field id="nu-name" label="Nome" autoComplete="off" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
              <Field id="nu-email" label="E-mail" type="email" autoComplete="off" maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} />
              <div>
                <div className="flex items-end gap-2">
                  <div className="min-w-0 flex-1">
                    <Field id="nu-pass" label="Senha temporária" autoComplete="off" maxLength={72} value={password} onChange={(e) => setPassword(e.target.value)} />
                  </div>
                  <Button type="button" variant="outline" size="icon" className="h-11 w-11" aria-label="Gerar outra senha" onClick={() => setPassword(generatePassword())}>
                    <RefreshCw size={16} />
                  </Button>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Mínimo de 8 caracteres, com letra e número. A pessoa troca no primeiro acesso.</p>
              </div>
            </Section>

            <Section title="Tipo de conta">
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="h-11 rounded-xl bg-card" aria-label="Tipo de conta">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={COMMON}>Usuário comum</SelectItem>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      Equipe: {ROLE_LABEL[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {role === COMMON ? "Usa o app como qualquer pessoa, sem acesso ao painel." : ROLE_HINT[role as StaffRole]}
              </p>
            </Section>

            <Section title="Acesso ao plano">
              <Choice<Access>
                label="Acesso ao plano"
                value={access}
                onChange={setAccess}
                options={[
                  { value: "nenhum", label: "Nenhum" },
                  { value: "cortesia", label: "Cortesia" },
                  { value: "assinatura", label: "Link de assinatura" },
                ]}
              />
              {access === "cortesia" && (
                <div className="space-y-2">
                  <Choice label="Meses de cortesia" value={months} onChange={setMonths} options={["1", "3", "6", "12"].map((m) => ({ value: m, label: `${m} ${m === "1" ? "mês" : "meses"}` }))} />
                  <Input className="h-11" maxLength={200} placeholder="Motivo (ex.: parceiro, imprensa, teste)" aria-label="Motivo da cortesia" value={reason} onChange={(e) => setReason(e.target.value)} />
                  <p className="text-xs text-muted-foreground">Plano Inteligência liberado sem pagamento. Não conta como assinante pagante nos relatórios.</p>
                </div>
              )}
              {access === "assinatura" && (
                <div className="space-y-2">
                  <Choice label="Período" value={period} onChange={setPeriod} options={[{ value: "mensal", label: "Mensal" }, { value: "anual", label: "Anual" }]} />
                  <p className="text-xs text-muted-foreground">Gera o link do Mercado Pago para a pessoa autorizar o cartão. O acesso começa quando o pagamento for aprovado.</p>
                </div>
              )}
            </Section>

            <Section title="Afiliado">
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input type="checkbox" className="h-5 w-5 accent-[var(--primary)]" checked={isAffiliate} onChange={(e) => setIsAffiliate(e.target.checked)} />
                Já cadastrar como afiliado aprovado
              </label>
              {isAffiliate && (
                <div className="space-y-3">
                  <Field
                    id="nu-code"
                    label="Código"
                    maxLength={20}
                    placeholder={suggestCode(name)}
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                  />
                  <Select value={mode} onValueChange={(v) => setMode(v as CommissionMode)}>
                    <SelectTrigger className="h-11 rounded-xl bg-card" aria-label="Regra da comissão">
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
                  <div className="grid grid-cols-2 gap-3">
                    <Field id="nu-rate" label="Comissão (%)" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
                    {mode === "meses" && <Field id="nu-months" label="Meses" inputMode="numeric" value={ruleMonths} onChange={(e) => setRuleMonths(e.target.value.replace(/\D/g, ""))} />}
                  </div>
                  {bp !== null && (
                    <p className="text-xs text-muted-foreground">
                      {describeRule({ mode, bp, months: rm })}. Ex.: pagamento de {formatMoney(monthlyPriceCents)} →{" "}
                      {formatMoney(commissionFor({ mode, bp, months: rm }, { paymentCents: monthlyPriceCents, paidAt: new Date().toISOString(), firstPaidAt: new Date().toISOString(), previousCount: 0 }))}.
                    </p>
                  )}
                </div>
              )}
            </Section>

            <DialogFooter>
              <Button disabled={busy} onClick={submit}>
                {busy ? "Criando…" : "Criar conta"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
