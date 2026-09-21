// SKMedKART Admin — cache refresh only
// This service worker does not change Billing, Stock, Purchase or Catalogue logic.
// It always fetches the current admin.js so an older cached build cannot keep the quota bug.
const CACHE='skmedkart-admin-v5.9.76-quota-only';
const ASSETS=['./','./index.html','./manifest.webmanifest'];
self.addEventListener('install',event=>event.waitUntil(
  caches.open(CACHE).then(async cache=>{
    for(const asset of ASSETS){
      try{const r=await fetch(asset,{cache:'no-store'});if(r.ok)await cache.put(asset,r.clone())}catch(e){}
    }
    await self.skipWaiting();
  })
));
self.addEventListener('activate',event=>event.waitUntil(
  caches.keys().then(keys=>Promise.all(
    keys.filter(k=>k.startsWith('skmedkart-admin-')&&k!==CACHE).map(k=>caches.delete(k))
  )).then(()=>self.clients.claim())
));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin===self.location.origin && url.pathname.endsWith('/admin.js')){
    event.respondWith(
      fetch(new Request(event.request,{cache:'no-store'}))
        .then(response=>{
          if(response.ok)caches.open(CACHE).then(cache=>cache.put(event.request,response.clone())).catch(()=>{});
          return response;
        })
        .catch(()=>caches.match(event.request))
    );
    return;
  }
  event.respondWith(
    fetch(event.request).then(response=>{
      if(response.ok)caches.open(CACHE).then(cache=>cache.put(event.request,response.clone())).catch(()=>{});
      return response;
    }).catch(()=>caches.match(event.request))
  );
});
