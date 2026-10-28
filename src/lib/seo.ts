// Metadados de página: título, descrição e as versões para compartilhamento (Open Graph).

export const APP_NAME = "Mitikos";
/** A promessa em uma linha: orçamento, patrimônio e aposentadoria num app só. */
export const APP_TAGLINE = "Orçamento, patrimônio e aposentadoria num app só.";

/**
 * `head` de uma rota: "Nome — Mitikos" como título e og:title. A descrição de
 * compartilhamento pode ser mais curta; sem ela, repete a descrição da página.
 */
export function pageHead(name: string, description: string, shareDescription = description) {
  const title = `${name} — ${APP_NAME}`;
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: shareDescription },
    ],
  };
}
