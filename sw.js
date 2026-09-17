const CACHE='skmedkart-admin-v5.9.70-ledger-final';
const ASSETS=[
  './',
  './index.html',
  './admin.js',
  './manifest.webmanifest',
  './invoice-top-logo.png',
  './invoice-footer-logo.jpg',
  './pharmacist_signature.jpg'
];

self.addEventListener('install',event=>{
  event.waitUntil(
    caches.open(CACHE).then(async cache=>{
      for(const asset of ASSETS){
        try{
          const r=await fetch(asset,{cache:'no-store'});
          if(r.ok) await cache.put(asset,r.clone());
        }catch{}
      }
      await self.skipWaiting();
    })
  );
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(
        keys
          .filter(k=>k.startsWith('skmedkart-admin-')&&k!==CACHE)
          .map(k=>caches.delete(k))
      ))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const u=new URL(event.request.url);

  // Never dynamically rewrite admin.js. The repository admin.js is the source of truth.
  if(u.origin===self.location.origin && u.pathname.endsWith('/admin.js')){
    event.respondWith(
      fetch(new Request(event.request,{cache:'no-store'}))
        .then(r=>{
          if(r&&r.ok)caches.open(CACHE).then(c=>c.put('./admin.js',r.clone())).catch(()=>{});
          return r;
        })
        .catch(()=>caches.match('./admin.js'))
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(r=>{
        if(r&&r.ok)caches.open(CACHE).then(c=>c.put(event.request,r.clone())).catch(()=>{});
        return r;
      })
      .catch(()=>caches.match(event.request))
  );
});
