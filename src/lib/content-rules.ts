export type ContentStatus = "rascunho" | "revisada" | "publicada";

/** Link de fonte aceito: só https (um "javascript:" num href executaria código). */
export function isSafeSourceUrl(url: string): boolean {
  try {
    return new URL(url.trim()).protocol === "https:";
  } catch {
    return false;
  }
}

/** Para usar em href: o link se for seguro, senão undefined (vira texto sem link). */
export function safeHref(url: string): string | undefined {
  return isSafeSourceUrl(url) ? url.trim() : undefined;
}

/** Regra §9.10: só publica com revisor, data de revisão e pelo menos uma fonte. */
export function publishBlockers(l: { reviewedBy: string | null; reviewedAt: string | null; sources: { label: string; url: string }[] }): string[] {
  const out: string[] = [];
  if (!l.reviewedBy?.trim()) out.push("Informe quem revisou.");
  if (!l.reviewedAt) out.push("Informe a data da revisão.");
  if (!l.sources.some((s) => s.label.trim() && s.url.trim())) out.push("Inclua pelo menos uma fonte.");
  if (l.sources.some((s) => s.url.trim() && !isSafeSourceUrl(s.url))) out.push("Os links das fontes precisam começar com https://.");
  return out;
}
