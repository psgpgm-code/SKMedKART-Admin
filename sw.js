const CACHE='skmedkart-admin-v5.9.15-order-receive';
const ASSETS=['./','./index.html','./admin.js?v=5.9.13-orders-receive','./manifest.webmanifest'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('skmedkart-admin-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const url=new URL(e.request.url);
  if(url.pathname.endsWith('/admin.js')){
    const versioned=new Request(new URL('./admin.js?v=5.9.13-orders-receive',self.registration.scope),{method:'GET',headers:e.request.headers,mode:'same-origin',credentials:e.request.credentials,cache:'no-store'});
    e.respondWith(fetch(versioned).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(versioned,copy)).catch(()=>{});return r}).catch(()=>caches.match(versioned)));
    return;
  }
  e.respondWith(fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy)).catch(()=>{});return r}).catch(()=>caches.match(e.request)));
});
