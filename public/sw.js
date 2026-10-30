// Service worker: instala o app, abre sem internet e recebe notificações.
//
// Cache:
// - Páginas: rede primeiro (nunca serve versão velha com internet); sem rede, a última cópia da página
//   e, se ela nunca foi aberta, a do Início (o app monta a tela certa no navegador).
// - /assets/ (nomes com hash, nunca mudam): cache primeiro.
// - Ícones, manifest e fontes do próprio site: cache e atualiza por trás.
// Nunca guarda /api/ nem nada de outro domínio (Supabase, Mercado Pago, fontes).
const VERSION = "v2";
const PAGES = `mitikos-pages-${VERSION}`;
const ASSETS = "mitikos-assets";
const STATIC = `mitikos-static-${VERSION}`;
const KEEP = new Set([PAGES, ASSETS, STATIC]);
const FALLBACK_PAGE = "/hoje";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (!KEEP.has(key)) await caches.delete(key);
      await self.clients.claim();
    })(),
  ),
);

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (req.mode === "navigate") event.respondWith(page(req, url));
  else if (url.pathname.startsWith("/assets/")) event.respondWith(cacheFirst(req));
  // Só arquivos estáticos: funções do servidor (/_serverFn) e dados nunca passam pelo cache.
  else if (STATIC_FILE.test(url.pathname)) event.respondWith(staleWhileRevalidate(req));
});
const STATIC_FILE = /\.(png|ico|svg|webmanifest|woff2?)$/;

async function page(req, url) {
  const cache = await caches.open(PAGES);
  try {
    const res = await fetch(req);
    if (res.ok && res.type === "basic") await cache.put(url.pathname, res.clone());
    return res;
  } catch (e) {
    const hit = (await cache.match(url.pathname)) || (await cache.match(FALLBACK_PAGE));
    if (hit) return hit;
    throw e;
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(ASSETS);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) await cache.put(req, res.clone());
  return res;
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(STATIC);
  const hit = await cache.match(req);
  const update = fetch(req)
    .then(async (res) => {
      if (res.ok) await cache.put(req, res.clone());
      return res;
    })
    .catch(() => hit);
  return hit || update;
}

// ---------- Notificações ----------
// O servidor manda { title, body, url, tag }. Nunca manda valores em reais (aparecem na tela bloqueada).
self.addEventListener("push", (event) => {
  let msg = {};
  try {
    msg = event.data ? event.data.json() : {};
  } catch {
    msg = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(msg.title || "Mitikos", {
      body: msg.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: msg.tag || "mitikos",
      data: { url: typeof msg.url === "string" && msg.url.startsWith("/") ? msg.url : "/hoje" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/hoje";
  event.waitUntil(
    (async () => {
      const open = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const c of open) {
        if (new URL(c.url).origin === self.location.origin && "focus" in c) {
          await c.navigate(target);
          return c.focus();
        }
      }
      return self.clients.openWindow(target);
    })(),
  );
});
