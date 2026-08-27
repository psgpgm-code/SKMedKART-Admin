const CACHE='skmedkart-v591-firebase-login-hard-fix-20260827';
const BASE='/SKMedKART-Admin/';
const ASSETS=[
  BASE,
  BASE+'index.html',
  BASE+'admin.js',
  BASE+'firebase-config.js',
  BASE+'shop-licence-config.js',
  BASE+'manifest.webmanifest',
  BASE+'icons/icon-192.png',
  BASE+'icons/icon-512.png',
  BASE+'icons/maskable-192.png',
  BASE+'icons/maskable-512.png'
];
self.addEventListener('install',event=>event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  await cache.addAll(ASSETS);
  await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  const keys=await caches.keys();
  await Promise.all(keys.filter(k=>k.startsWith('skmedkart-')&&k!==CACHE).map(k=>caches.delete(k)));
  await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET') return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin) return;
  if(event.request.mode==='navigate'){
    event.respondWith(fetch(event.request).catch(async()=>{
      const cache=await caches.open(CACHE);
      return (await cache.match(BASE))||(await cache.match(BASE+'index.html'));
    }));
    return;
  }
  event.respondWith(fetch(event.request).then(response=>{
    if(response&&response.ok){
      const copy=response.clone();
      caches.open(CACHE).then(cache=>cache.put(event.request,copy));
    }
    return response;
  }).catch(async()=>{
    const cache=await caches.open(CACHE);
    return cache.match(event.request);
  }));
});