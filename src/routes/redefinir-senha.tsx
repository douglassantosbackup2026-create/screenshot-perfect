import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AuthShell, Field } from "@/components/auth/AuthShell";
import { supabase } from "@/integrations/supabase/client";
import { authErrorMessage, passwordProblems } from "@/lib/auth/password";
import { APP_NAME } from "@/lib/seo";

export const Route = createFileRoute("/redefinir-senha")({
  head: () => ({
    meta: [
      { title: `Nova senha — ${APP_NAME}` },
      { name: "description", content: "Crie uma nova senha para sua conta." },
      { property: "og:title", content: `Nova senha — ${APP_NAME}` },
      { property: "og:description", content: "Crie uma nova senha para sua conta." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Reset,
});

function Reset() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((e, s) => {
      if (e === "PASSWORD_RECOVERY" || s) setReady(true);
    });
    void supabase.auth.getSession().then(({ data: d }) => d.session && setReady(true));
    return () => data.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const p = passwordProblems(password);
    if (p.length) { toast.error(p[0]); return; }
    if (password !== confirm) { toast.error("As senhas não são iguais."); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) { toast.error(authErrorMessage(error.message)); return; }
    toast.success("Senha alterada.");
    navigate({ to: "/hoje", replace: true });
  }

  return (
    <AuthShell title="Nova senha">
      {ready ? (
        <form className="mt-6 space-y-4" onSubmit={submit}>
          <Field id="password" label="Nova senha" type="password" required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <p className="text-xs text-muted-foreground">Mínimo de 8 caracteres, com letra e número.</p>
          <Field id="confirm" label="Confirmar nova senha" type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          <Button type="submit" className="w-full" disabled={busy}>{busy ? "Salvando…" : "Salvar nova senha"}</Button>
        </form>
      ) : (
        <p className="mt-3 text-muted-foreground">
          Abra esta página pelo link do e-mail. Se o link expirou,{" "}
          <Link to="/esqueci-senha" className="font-semibold text-primary">peça outro</Link>.
        </p>
      )}
    </AuthShell>
  );
}
