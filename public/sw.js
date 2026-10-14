const CACHE='chessito-offline-v1';
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(['/offline.html','/icons/icon-192.png'])).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('chessito-offline-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
// Private pages, games, API keys, API replies, and login requests are never cached.
self.addEventListener('fetch',event=>{if(event.request.method==='GET'&&event.request.mode==='navigate')event.respondWith(fetch(event.request).catch(()=>caches.match('/offline.html')));});
