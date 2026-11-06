// Tiene sul telefono le pagine della webapp, così si apre anche senza rete.
// Le richieste a Dropbox non passano da qui.
const CASSA = 'commesse-prova-1';
const PAGINE = ['./', 'index.html', 'manifest.json', 'icona-180.png', 'icona-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CASSA).then(c => c.addAll(PAGINE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(nomi => Promise.all(nomi.filter(n => n !== CASSA).map(n => caches.delete(n))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // Prima la rete, per avere sempre l'ultima versione; senza rete la copia salvata.
  e.respondWith(
    fetch(e.request)
      .then(r => {
        if (r.ok) { const copia = r.clone(); caches.open(CASSA).then(c => c.put(e.request, copia)); }
        return r;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('./')))
  );
});
