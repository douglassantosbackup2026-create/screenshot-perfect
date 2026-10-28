// Service worker mínimo: só permite instalar o app na tela inicial.
// Não guarda nada em cache; toda requisição vai direto para a rede, então nunca serve uma versão velha.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
