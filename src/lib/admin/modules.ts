// Módulos do painel administrativo e quem acessa cada um. Única fonte para o menu e para o guard das rotas;
// o banco confere de novo em cada função (staff_has), então esconder aqui é só conforto, não proteção.
import { redirect } from "@tanstack/react-router";

export type StaffRole = "super_admin" | "financeiro" | "marketing" | "suporte" | "analista";

export const ROLE_LABEL: Record<StaffRole, string> = {
  super_admin: "Super admin",
  financeiro: "Financeiro",
  marketing: "Marketing",
  suporte: "Suporte",
  analista: "Analista",
};

export const ROLE_HINT: Record<StaffRole, string> = {
  super_admin: "Tudo, inclusive perfis, integrações e operações críticas.",
  financeiro: "Assinaturas, pagamentos, preços, cupons e conciliação.",
  marketing: "Leads, campanhas, simulações, conteúdos e cupons.",
  suporte: "Atendimento, ficha operacional dos usuários e incidentes.",
  analista: "Só leitura de painéis e relatórios agregados.",
};

export type AdminPath =
  | "/admin"
  | "/admin/assinaturas"
  | "/admin/precos"
  | "/admin/cupons"
  | "/admin/afiliados"
  | "/admin/usuarios"
  | "/admin/atendimento"
  | "/admin/leads"
  | "/admin/uso"
  | "/admin/simulacoes"
  | "/admin/funil"
  | "/admin/marketing"
  | "/admin/conteudo"
  | "/admin/calculadora"
  | "/admin/monitoramento"
  | "/admin/seguranca"
  | "/admin/configuracoes";

export type AdminModule = {
  path: AdminPath;
  title: string;
  group: string;
  /** Quem vê o módulo (super_admin sempre vê). */
  read: StaffRole[];
  /** Quem altera algo no módulo; os demais só leem. */
  write: StaffRole[];
};

export const MODULES: AdminModule[] = [
  { path: "/admin", title: "Visão geral", group: "", read: ["financeiro", "marketing", "suporte", "analista"], write: [] },
  { path: "/admin/assinaturas", title: "Assinaturas e faturamento", group: "Negócio", read: ["financeiro", "analista"], write: ["financeiro"] },
  { path: "/admin/precos", title: "Preços", group: "Negócio", read: ["financeiro"], write: ["financeiro"] },
  { path: "/admin/cupons", title: "Cupons", group: "Negócio", read: ["financeiro", "marketing"], write: ["financeiro", "marketing"] },
  { path: "/admin/afiliados", title: "Afiliados", group: "Negócio", read: ["financeiro", "marketing"], write: ["financeiro", "marketing"] },
  { path: "/admin/usuarios", title: "Usuários", group: "Pessoas", read: ["suporte", "financeiro"], write: ["financeiro"] },
  { path: "/admin/atendimento", title: "Atendimento", group: "Pessoas", read: ["suporte"], write: ["suporte"] },
  { path: "/admin/leads", title: "Leads", group: "Pessoas", read: ["marketing"], write: ["marketing"] },
  { path: "/admin/uso", title: "Uso das funcionalidades", group: "Produto", read: ["marketing", "analista"], write: [] },
  { path: "/admin/simulacoes", title: "Simulações", group: "Produto", read: ["marketing", "analista"], write: [] },
  { path: "/admin/funil", title: "Analytics", group: "Produto", read: ["marketing", "analista"], write: [] },
  { path: "/admin/marketing", title: "Marketing", group: "Produto", read: ["marketing", "analista"], write: [] },
  { path: "/admin/conteudo", title: "Conteúdos", group: "Conteúdo", read: ["marketing"], write: ["marketing"] },
  { path: "/admin/calculadora", title: "Calculadora", group: "Conteúdo", read: [], write: [] },
  { path: "/admin/monitoramento", title: "Monitoramento", group: "Operação", read: ["suporte"], write: [] },
  { path: "/admin/seguranca", title: "Segurança", group: "Operação", read: [], write: [] },
  { path: "/admin/configuracoes", title: "Configurações", group: "Operação", read: [], write: [] },
];

const has = (roles: StaffRole[], allowed: StaffRole[]) => roles.includes("super_admin") || roles.some((r) => allowed.includes(r));

export const moduleOf = (path: string) => MODULES.find((m) => m.path === path);
export const canRead = (roles: StaffRole[], path: AdminPath) => has(roles, moduleOf(path)?.read ?? []);
export const canWrite = (roles: StaffRole[], path: AdminPath) => has(roles, moduleOf(path)?.write ?? []);
export const visibleModules = (roles: StaffRole[]) => MODULES.filter((m) => has(roles, m.read));

/** Para o beforeLoad de cada módulo: sem acesso, volta para a visão geral do painel. */
export function requireModule(roles: StaffRole[], path: AdminPath) {
  if (!canRead(roles, path)) throw redirect({ to: "/admin", replace: true });
}
