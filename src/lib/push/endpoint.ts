// Para onde o servidor aceita mandar push: só os serviços de push dos navegadores.
// O endpoint é gravado pelo cliente; sem esta lista, o cron faria requisições para qualquer endereço (SSRF).
// Mesma lista do check push_endpoint_servico_conhecido (migration 20261107120000).
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /^[a-z0-9-]+\.notify\.windows\.com$/,
  /^web\.push\.apple\.com$/,
  /^[a-z0-9-]+\.push\.apple\.com$/,
];

export function isPushEndpoint(endpoint: string): boolean {
  try {
    const u = new URL(endpoint);
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      !u.port &&
      PUSH_HOSTS.some((h) => h.test(u.hostname))
    );
  } catch {
    return false;
  }
}
