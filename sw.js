// SKMedKART Admin V5.9.63 — clean Service Worker
// No runtime source-code rewriting. admin.js is served as-is.
const CACHE='skmedkart-admin-v5.9.63-final';
const ADMIN='./admin.js?v=5.9.63-final';
const ASSETS=['./','./index.html',ADMIN,'./manifest.webmanifest','./invoice-top-logo.png','./invoice-footer-logo.jpg','./pharmacist_signature.jpg'];

self.addEventListener('install',event=>event.waitUntil(
  caches.open(CACHE).then(async cache=>{
    for(const asset of ASSETS){
      try{
        const response=await fetch(asset,{cache:'no-store'});
        if(response.ok)await cache.put(asset,response.clone());
      }catch(e){}
    }
    await self.skipWaiting();
  })
));

self.addEventListener('activate',event=>event.waitUntil(
  caches.keys().then(keys=>Promise.all(
    keys.filter(key=>key.startsWith('skmedkart-admin-')&&key!==CACHE).map(key=>caches.delete(key))
  )).then(()=>self.clients.claim())
));

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin===self.location.origin && url.pathname.endsWith('/admin.js')){
    event.respondWith(
      fetch(new Request(event.request,{cache:'no-store'}))
        .then(response=>{
          if(response.ok)caches.open(CACHE).then(cache=>cache.put(ADMIN,response.clone())).catch(()=>{});
          return response;
        })
        .catch(()=>caches.match(ADMIN))
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
