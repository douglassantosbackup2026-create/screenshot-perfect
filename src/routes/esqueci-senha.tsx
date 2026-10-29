import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AuthShell, Field } from "@/components/auth/AuthShell";
import { supabase } from "@/integrations/supabase/client";
import { authErrorMessage } from "@/lib/auth/password";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/esqueci-senha")({
  head: () => pageHead("Esqueci minha senha", "Receba um link por e-mail para criar uma nova senha.", "Recupere o acesso à sua conta."),
  component: Forgot,
});

function Forgot() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });
    setBusy(false);
    if (error) { toast.error(authErrorMessage(error.message)); return; }
    setSent(true);
  }

  return (
    <AuthShell title="Esqueci minha senha" subtitle={sent ? undefined : "Enviamos um link para você criar uma nova senha."}>
      {sent ? (
        <p className="mt-3" role="status">
          Se houver conta com <strong>{email}</strong>, o link chega em instantes. Confira também o spam.
        </p>
      ) : (
        <form className="mt-6 space-y-4" onSubmit={submit}>
          <Field id="email" label="E-mail" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button type="submit" className="w-full" disabled={busy}>{busy ? "Enviando…" : "Enviar link"}</Button>
        </form>
      )}
      <p className="mt-6 text-center text-sm">
        <Link to="/entrar" className="font-semibold text-primary">Voltar para entrar</Link>
      </p>
    </AuthShell>
  );
}
