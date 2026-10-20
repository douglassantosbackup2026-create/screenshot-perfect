// Origem da visita (utm_source, utm_medium, utm_campaign), guardada na primeira página da visita.
const KEY = "pi_utm";
export type Utm = { source: string | null; medium: string | null; campaign: string | null };

/** Guarda as UTMs da URL atual, se houver (a primeira página da visita vence). */
export function captureUtm() {
  try {
    const q = new URLSearchParams(window.location.search);
    const utm: Utm = { source: q.get("utm_source"), medium: q.get("utm_medium"), campaign: q.get("utm_campaign") };
    if ((utm.source || utm.medium || utm.campaign) && !window.sessionStorage.getItem(KEY)) window.sessionStorage.setItem(KEY, JSON.stringify(utm));
  } catch {
    /* sem armazenamento: segue sem UTM */
  }
}

export function getUtm(): Utm {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Utm) : { source: null, medium: null, campaign: null };
  } catch {
    return { source: null, medium: null, campaign: null };
  }
}
