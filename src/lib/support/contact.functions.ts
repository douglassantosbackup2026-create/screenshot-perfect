// Contato de quem não tem conta (página /contato). Sem login: valida, limita por IP e e-mail e grava o chamado
// com o service role. Quem tem conta abre o chamado pelo Perfil (open_ticket), e vê as respostas lá.
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { allow, clientIp, TOO_MANY } from "@/lib/security/rate-limit.server";

const TRY_AGAIN = "Não foi possível enviar agora. Tente de novo em instantes." as const;

export const ContactInput = z.object({
  name: z.string().trim().max(120).default(""),
  email: z.string().trim().toLowerCase().email("E-mail inválido.").max(254),
  kind: z.enum(["duvida", "sugestao", "reclamacao", "erro", "cancelamento", "exclusao_dados"]),
  subject: z.string().trim().min(3, "Escreva o assunto.").max(140),
  body: z.string().trim().min(1, "Escreva a mensagem.").max(4000),
});

export const submitContact = createServerFn({ method: "POST" })
  .validator((d) => ContactInput.parse(d))
  .handler(async ({ data }) => {
    const ip = clientIp(getRequest());
    if (
      !(await allow([
        { key: `contact:ip:${ip}`, limit: 5, windowSeconds: 3600 },
        { key: `contact:email:${data.email}`, limit: 5, windowSeconds: 86400 },
      ]))
    )
      return { error: TOO_MANY };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: t, error } = await supabaseAdmin
      .from("support_tickets")
      .insert({ email: data.email, name: data.name, kind: data.kind, subject: data.subject })
      .select("id")
      .single();
    if (error || !t) {
      console.error("contact ticket failed", error?.message);
      return { error: TRY_AGAIN };
    }
    const msg = await supabaseAdmin.from("support_messages").insert({ ticket_id: t.id, author: "usuario", body: data.body });
    if (msg.error) {
      console.error("contact message failed", msg.error.message);
      return { error: TRY_AGAIN };
    }
    return { error: null };
  });
