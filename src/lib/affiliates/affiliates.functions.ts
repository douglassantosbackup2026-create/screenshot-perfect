// Inscrição pública no programa de parceiros. Sem login: grava com o service role depois de validar e
// limitar por IP. E-mail já inscrito recebe a mesma resposta (ninguém descobre quem é parceiro).
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { allow, clientIp, TOO_MANY } from "@/lib/security/rate-limit.server";

const TRY_AGAIN = "Não foi possível enviar agora. Tente de novo em instantes." as const;

export const AffiliateApplication = z.object({
  name: z.string().trim().min(2, "Informe seu nome.").max(120),
  email: z.string().trim().toLowerCase().email("E-mail inválido.").max(254),
  whatsapp: z.string().trim().max(30).default(""),
  instagram: z.string().trim().max(100).default(""),
  pixKey: z.string().trim().max(140).default(""),
  message: z.string().trim().max(1000).default(""),
  terms: z.literal(true),
  managerCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{4,20}$/).optional().catch(undefined),
});

export const applyAffiliate = createServerFn({ method: "POST" })
  .validator((d) => AffiliateApplication.parse(d))
  .handler(async ({ data }) => {
    const ip = clientIp(getRequest());
    if (
      !(await allow([
        { key: `affiliate:apply:ip:${ip}`, limit: 5, windowSeconds: 3600 },
        { key: `affiliate:apply:email:${data.email}`, limit: 3, windowSeconds: 86400 },
      ]))
    )
      return { error: TOO_MANY };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Convite de gerente: liga o novo parceiro ao gerente ativo dono do código.
    let managerId: string | null = null;
    if (data.managerCode) {
      const { data: m } = await supabaseAdmin.from("affiliate_managers").select("id").eq("code", data.managerCode).eq("active", true).maybeSingle();
      managerId = m?.id ?? null;
    }
    const { error } = await supabaseAdmin.from("affiliates").insert({
      manager_id: managerId,
      name: data.name,
      email: data.email,
      whatsapp: data.whatsapp,
      instagram: data.instagram,
      pix_key: data.pixKey,
      message: data.message,
    });
    // 23505 = e-mail já inscrito: mesma resposta de sucesso.
    if (error && error.code !== "23505") {
      console.error("affiliate apply failed", error.message);
      return { error: TRY_AGAIN };
    }
    return { error: null };
  });
