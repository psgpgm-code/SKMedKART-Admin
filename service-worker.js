const CACHE='skmedkart-shell-v5.8-pwa-final-20260826-1920';
const BASE='/SKMedKART-Admin/';
const SHELL=['','index.html','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png','icons/maskable-192.png','icons/maskable-512.png'];
self.addEventListener('install',event=>event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  await Promise.all(SHELL.map(async p=>{try{const r=await fetch(BASE+p,{cache:'reload'});if(r&&r.ok)await cache.put(BASE+p,r.clone());}catch(_){}}));
  await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  const keys=await caches.keys();
  await Promise.all(keys.filter(k=>k.startsWith('skmedkart-')&&k!==CACHE).map(k=>caches.delete(k)));
  await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==location.origin||!url.pathname.startsWith(BASE))return;
  if(event.request.mode==='navigate'){
    event.respondWith(fetch(event.request).catch(()=>caches.match(BASE+'index.html')));
    return;
  }
  event.respondWith(fetch(event.request).then(r=>{
    if(r&&r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put(event.request,copy));}
    return r;
  }).catch(()=>caches.match(event.request)));
});
