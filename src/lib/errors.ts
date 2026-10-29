/** Texto de um erro capturado, para mostrar à pessoa. O que não for um Error vira uma mensagem genérica. */
export function errMsg(e: unknown, fallback = "Não foi possível concluir agora. Tente de novo."): string {
  return e instanceof Error && e.message ? e.message : fallback;
}
