// Service Worker do Fatiador de Imagens
// Faz o cache de todos os arquivos do app na instalação, para que a ferramenta
// funcione completamente offline depois da primeira visita.

const CACHE_VERSION = 'fatiador-v1';
const APP_SHELL = [
  './',
  './index.html',
  './css/style.css',
  './js/main.js',
  './js/vendor/jszip.min.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// ---- instalação: baixa e guarda tudo que o app precisa ----
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// ---- ativação: remove caches de versões antigas ----
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ---- fetch: cache-first, com fallback de rede ----
// Isso garante que, uma vez visitado com internet, o app abre e funciona
// mesmo sem conexão nas próximas vezes.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((response) => {
          // guarda uma cópia no cache para uso offline futuro
          if (response && response.status === 200 && response.type === 'basic') {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          // sem rede e sem cache: se for navegação de página, devolve o app shell
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
    })
  );
});
