// Sessão e conta: login por e-mail e senha (Supabase Auth) e o modo "experimentar sem conta".
// Logado, o app usa o banco (src/lib/data/cloud.ts); sem login, o modo demonstração guarda tudo só neste aparelho.
import { useSyncExternalStore } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

const DEMO_FLAG = "pi_demo_mode";
export const PASSWORD_MIN = 8;

type SessionState = { ready: boolean; session: Session | null };
let state: SessionState = { ready: false, session: null };
const listeners = new Set<() => void>();
const set = (next: SessionState) => {
  state = next;
  listeners.forEach((l) => l());
};

let started = false;
/** Começa a acompanhar a sessão (uma vez, no navegador). */
export function startSession() {
  if (started || typeof window === "undefined") return;
  started = true;
  supabase.auth.getSession().then(({ data }) => set({ ready: true, session: data.session }));
  supabase.auth.onAuthStateChange((_event, session) => set({ ready: true, session }));
}

const SERVER_STATE: SessionState = { ready: false, session: null };
export function useSession(): SessionState {
  startSession();
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => SERVER_STATE,
  );
}

/** Espera a primeira leitura da sessão (para a trava das rotas). */
export async function getSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

// ---------- Modo demonstração ----------
export function isDemoMode(): boolean {
  try {
    return typeof window !== "undefined" && window.localStorage.getItem(DEMO_FLAG) === "1";
  } catch {
    return false;
  }
}
export function setDemoMode(on: boolean) {
  try {
    if (on) window.localStorage.setItem(DEMO_FLAG, "1");
    else window.localStorage.removeItem(DEMO_FLAG);
  } catch {
    /* armazenamento indisponível */
  }
}

// ---------- Conta ----------
const MESSAGES: [RegExp, string][] = [
  [/invalid login credentials/i, "E-mail ou senha incorretos."],
  [/email not confirmed/i, "Confirme seu e-mail antes de entrar. Procure a mensagem que enviamos (veja também o spam)."],
  [/already registered|already exists/i, "Já existe uma conta com esse e-mail. Entre ou redefina a senha."],
  [/password should be at least|weak password/i, `A senha precisa ter pelo menos ${PASSWORD_MIN} caracteres, com letras e números.`],
  [/rate limit|too many/i, "Muitas tentativas seguidas. Espere um minuto e tente de novo."],
  [/invalid email|unable to validate email/i, "Confira o e-mail digitado."],
  [/same password|different from the old/i, "A nova senha precisa ser diferente da atual."],
];
export function authMessage(e: unknown): string {
  const raw = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : String(e);
  return MESSAGES.find(([re]) => re.test(raw))?.[1] ?? "Não foi possível concluir agora. Tente de novo em instantes.";
}

/** Senha com pelo menos 8 caracteres, uma letra e um número. Devolve o problema ou null. */
export function passwordProblem(pw: string): string | null {
  if (pw.length < PASSWORD_MIN) return `Use pelo menos ${PASSWORD_MIN} caracteres.`;
  if (!/[a-zA-Z]/.test(pw) || !/\d/.test(pw)) return "Misture letras e números.";
  return null;
}

const origin = () => (typeof window !== "undefined" ? window.location.origin : "");

export const account = {
  /** Cria a conta. Com confirmação de e-mail ligada no projeto, volta sem sessão: a pessoa confirma e depois entra. */
  async signUp(email: string, password: string, displayName: string) {
    const problem = passwordProblem(password);
    if (problem) throw new Error(problem);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      // handle_new_user cria o perfil lendo o nome de raw_user_meta_data->>'name'.
      options: { data: { name: displayName.trim() }, emailRedirectTo: `${origin()}/entrar?confirmado=1` },
    });
    if (error) throw new Error(authMessage(error));
    // Com e-mail já cadastrado e confirmação ligada, o Supabase devolve um usuário sem identidades.
    if (data.user && data.user.identities && data.user.identities.length === 0) throw new Error(authMessage("already registered"));
    setDemoMode(false);
    return { needsConfirmation: !data.session };
  },
  async signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw new Error(authMessage(error));
    setDemoMode(false);
  },
  async signOut() {
    await supabase.auth.signOut();
  },
  /** Manda o e-mail para criar uma nova senha; o link abre /redefinir-senha. */
  async requestPasswordReset(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${origin()}/redefinir-senha` });
    if (error) throw new Error(authMessage(error));
  },
  async updatePassword(password: string) {
    const problem = passwordProblem(password);
    if (problem) throw new Error(problem);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw new Error(authMessage(error));
  },
  /** Exclui a conta e todos os dados (delete_my_account apaga o usuário; as tabelas apagam em cascata). */
  async deleteAccount() {
    const { error } = await supabase.rpc("delete_my_account" as never);
    if (error) throw new Error(authMessage(error));
    await supabase.auth.signOut();
  },
};
