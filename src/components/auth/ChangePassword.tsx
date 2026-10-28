import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/auth/AuthShell";
import { supabase } from "@/integrations/supabase/client";
import { authErrorMessage, passwordProblems } from "@/lib/auth/password";

export function ChangePassword() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const p = passwordProblems(next);
    if (p.length) { toast.error(p[0]); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: next, current_password: current });
    setBusy(false);
    if (error) { toast.error(authErrorMessage(error.message)); return; }
    toast.success("Senha alterada.");
    setOpen(false); setCurrent(""); setNext("");
  }

  if (!open)
    return (
      <button type="button" className="min-h-11 py-3 text-left" onClick={() => setOpen(true)}>
        Trocar senha
      </button>
    );
  return (
    <form className="space-y-3 py-3" onSubmit={submit}>
      <Field id="cur-pass" label="Senha atual" type="password" required autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
      <Field id="new-pass" label="Nova senha" type="password" required autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>{busy ? "Salvando…" : "Salvar"}</Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
      </div>
    </form>
  );
}
