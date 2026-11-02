// Tipos e situações dos chamados de atendimento (iguais aos checks de support_tickets no banco).
export type TicketKind = "duvida" | "sugestao" | "reclamacao" | "erro" | "cancelamento" | "exclusao_dados";
export type TicketStatus = "aberto" | "em_andamento" | "resolvido" | "fechado";

export const TICKET_KIND: Record<TicketKind, string> = {
  duvida: "Dúvida",
  sugestao: "Sugestão",
  reclamacao: "Reclamação",
  erro: "Relato de erro",
  cancelamento: "Cancelamento",
  exclusao_dados: "Exclusão de dados",
};

export const TICKET_STATUS: Record<TicketStatus, string> = {
  aberto: "Aberto",
  em_andamento: "Em andamento",
  resolvido: "Resolvido",
  fechado: "Fechado",
};
