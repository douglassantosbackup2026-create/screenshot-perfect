import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { AuthShell, Field } from "@/components/auth/AuthShell";
import { supabase } from "@/integrations/supabase/client";
import { authErrorMessage, passwordProblems, safePath } from "@/lib/auth/password";
import { CALC_PREFILL_KEY } from "@/lib/data/demo-store";
import { pageHead } from "@/lib/seo";
import { track } from "@/lib/analytics/analytics";
import { captureRef, currentRef, normalizeRef, saveRef } from "@/lib/affiliates/ref";

export const Route = createFileRoute("/cadastro")({
  validateSearch: z.object({ redirect: z.string().optional() }),
  head: () => pageHead("Criar conta", "Crie sua conta e assine para cuidar do orçamento, do patrimônio e da aposentadoria num app só.", "Crie sua conta e escolha seu plano."),
  component: SignUp,
});

function SignUp() {
  const { redirect: target } = Route.useSearch();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  // Quem veio da calculadora já tem a conta feita: o cadastro só salva.
  const [fromCalc, setFromCalc] = useState(false);
  useEffect(() => setFromCalc(!!window.sessionStorage.getItem(CALC_PREFILL_KEY)), []);
  // Código de afiliado: vem do link (?ref=) ou a pessoa digita. Só liga a conta ao afiliado.
  const [refCode, setRefCode] = useState("");
  const [linkRef, setLinkRef] = useState<string | null>(null);
  useEffect(() => {
    captureRef(window.location.search);
    const code = currentRef()?.code ?? null;
    setLinkRef(code);
    if (code) setRefCode(code);
  }, []);
  const problems = passwordProblems(password);
  const next = safePath(target, "/onboarding");

  /** Guarda o código digitado; undefined se o formato estiver errado (já avisou). */
  function keepRef(): { ref?: string; ref_source?: string } | undefined {
    if (!refCode.trim()) return {};
    const code = normalizeRef(refCode);
    if (!code) {
      toast.error("Código de indicação inválido: use só letras e números.");
      return undefined;
    }
    const source = code === linkRef ? "link" : "cupom";
    saveRef(code, source);
    return { ref: code, ref_source: source };
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (problems.length) return void toast.error(problems[0]);
    if (!terms) return void toast.error("Aceite os termos para continuar.");
    const ref = keepRef();
    if (!ref) return;
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { display_name: name.trim(), ...ref } },
    });
    setBusy(false);
    if (error) return void toast.error(authErrorMessage(error.message));
    track("signup_completed", { confirmEmail: !data.session });
    if (!data.session) {
      toast("Conta criada. Confirme pelo link que enviamos para o seu e-mail e depois entre.");
      return void navigate({ to: "/entrar", search: { redirect: next }, replace: true });
    }
    toast.success("Conta criada!");
    navigate({ to: next, replace: true });
  }

  return (
    <AuthShell
      title={fromCalc ? "Salve seu plano" : "Criar conta"}
      subtitle={fromCalc ? "Seu cálculo já está pronto. Crie sua conta e assine para guardar e acompanhar todo mês." : "Leva menos de um minuto. Depois, você escolhe seu plano."}
    >
      <form className="mt-6 space-y-4" onSubmit={submit}>
        <Field id="name" label="Seu nome" required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
        <Field id="email" label="E-mail" type="email" required autoComplete="email" placeholder="voce@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <div>
          <Field
            id="password"
            label="Senha"
            type={showPassword ? "text" : "password"}
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <div className="mt-1 flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">Mínimo de 8 caracteres, com letra e número.</p>
            <button type="button" className="min-h-11 shrink-0 text-sm font-semibold text-primary" onClick={() => setShowPassword((v) => !v)} aria-pressed={showPassword}>
              {showPassword ? "Esconder" : "Mostrar"}
            </button>
          </div>
        </div>
        <Field
          id="ref"
          label="Código de indicação (opcional)"
          autoComplete="off"
          autoCapitalize="characters"
          maxLength={20}
          value={refCode}
          onChange={(e) => setRefCode(e.target.value.toUpperCase())}
        />
        <label className="flex items-start gap-3 text-sm">
          <Checkbox checked={terms} onCheckedChange={(v) => setTerms(v === true)} className="mt-0.5" />
          <span>
            Li e aceito os <Link to="/sobre" className="font-semibold text-primary">termos de uso</Link> e a{" "}
            <Link to="/privacidade" className="font-semibold text-primary">política de privacidade</Link>.
          </span>
        </label>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Criando…" : fromCalc ? "Salvar meu plano" : "Criar conta"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm">
        Já tem conta?{" "}
        <Link to="/entrar" search={{ redirect: target }} className="inline-flex min-h-11 items-center font-semibold text-primary">
          Entrar
        </Link>
      </p>
    </AuthShell>
  );
}
