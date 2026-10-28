// Metadados de página: título, descrição e as versões para compartilhamento (Open Graph).

export const APP_NAME = "Previdência Intelligence";

/**
 * `head` de uma rota: "Nome — Previdência Intelligence" como título e og:title. A descrição de
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
