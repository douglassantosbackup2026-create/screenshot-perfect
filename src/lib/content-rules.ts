export type ContentStatus = "rascunho" | "revisada" | "publicada";

/** Regra §9.10: só publica com revisor, data de revisão e pelo menos uma fonte. */
export function publishBlockers(l: { reviewedBy: string | null; reviewedAt: string | null; sources: { label: string; url: string }[] }): string[] {
  const out: string[] = [];
  if (!l.reviewedBy?.trim()) out.push("Informe quem revisou.");
  if (!l.reviewedAt) out.push("Informe a data da revisão.");
  if (!l.sources.some((s) => s.label.trim() && s.url.trim())) out.push("Inclua pelo menos uma fonte.");
  return out;
}
