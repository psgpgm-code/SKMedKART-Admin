const CACHE='skmedkart-v58-install-final-20260826';
const ASSETS=['./','./index.html','./admin.js','./firebase-config.js','./shop-licence-config.js','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png','./icons/maskable-192.png','./icons/maskable-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('skmedkart-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET') return;
 event.respondWith(fetch(event.request).then(response=>response).catch(()=>caches.match(event.request).then(r=>r||caches.match('./index.html'))));
});
