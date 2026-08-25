const C='skmedkart-v56-complete-corrected-20260825';
const A=['./','./index.html','./admin.js','./firebase-config.js','./shop-licence-config.js','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(C).then(c=>c.addAll(A)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
 if(e.request.method!=='GET')return;
 if(e.request.mode==='navigate'){
   e.respondWith(fetch(e.request).then(r=>r).catch(()=>caches.match('./index.html')));
   return;
 }
 e.respondWith(fetch(e.request).then(r=>{
   const copy=r.clone();
   caches.open(C).then(c=>c.put(e.request,copy));
   return r;
 }).catch(()=>caches.match(e.request)));
});
