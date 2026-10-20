// Service worker do Previdência Intelligence: deixa o app instalável e abre a casca do app sem rede.
// Nunca guarda dados financeiros: chamadas ao Supabase e a funções do servidor sempre vão direto para a rede.
const CACHE = "pi-shell-v1";
const SHELL = ["/", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Só o próprio site; nada de Supabase, analytics ou funções do servidor.
  if (url.origin !== self.location.origin || url.pathname.startsWith("/_serverFn") || url.pathname.startsWith("/api/")) return;

  // Arquivos com hash no nome (JS, CSS, fontes, imagens): do cache primeiro, porque nunca mudam.
  if (url.pathname.startsWith("/assets/") || /\.(png|svg|ico|woff2?)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ??
          fetch(req).then((res) => {
            if (res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone()));
            return res;
          }),
      ),
    );
    return;
  }

  // Páginas: sempre da rede (para nunca mostrar algo velho); sem rede, a última casca guardada.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) caches.open(CACHE).then((c) => c.put("/", res.clone()));
          return res;
        })
        .catch(() => caches.match("/").then((hit) => hit ?? Response.error())),
    );
  }
});
