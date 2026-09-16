const CACHE='skmedkart-admin-v5.9.57-billing-stock-safe';

const ADMIN='./admin.js?v=5.9.50-stock-integrity-full-audit';

function patchAdminSource(text){

  let out=text;

  /*
    V5.9.57
    localStorage quota protection.

    bills / purchases / stockMovements remain normal.
    batches / products are derived stock caches, so if the browser
    quota is full, their write must not crash the whole transaction.
  */

  const oldSet=
    "const get=(k,d)=>{try{return JSON.parse(localStorage.getItem(K+k)||JSON.stringify(d))}catch{return d}},set=(k,v)=>localStorage.setItem(K+k,JSON.stringify(v));";

  const newSet=
    "const get=(k,d)=>{try{return JSON.parse(localStorage.getItem(K+k)||JSON.stringify(d))}catch{return d}},safeSet=(k,v)=>{try{return localStorage.setItem(K+k,JSON.stringify(v))}catch(e){if(e&&e.name==='QuotaExceededError'&&(k==='batches'||k==='products')){console.warn('SKMedKART: stock cache write skipped because localStorage quota is full:',k);return false}throw e}},set=(k,v)=>safeSet(k,v);";

  if(out.includes(oldSet)){
    out=out.replace(oldSet,newSet);
  }

  return out;
}


async function getPatchedAdminResponse(request){

  const versioned=new Request(
    new URL(ADMIN,self.registration.scope),
    {
      method:'GET',
      headers:request.headers,
      mode:'same-origin',
      credentials:request.credentials,
      cache:'no-store'
    }
  );

  const response=await fetch(versioned);

  const source=await response.text();

  const patched=patchAdminSource(source);

  return new Response(
    patched,
    {
      status:response.status,
      statusText:response.statusText,
      headers:response.headers
    }
  );
}


self.addEventListener('install',e=>
  e.waitUntil(
    (async()=>{

      const cache=await caches.open(CACHE);

      await cache.addAll([
        './',
        './index.html',
        './manifest.webmanifest',
        './invoice-top-logo.png',
        './invoice-footer-logo.jpg',
        './pharmacist_signature.jpg'
      ]);

      try{

        const patched=
          await getPatchedAdminResponse(
            new Request(
              new URL(
                ADMIN,
                self.registration.scope
              )
            )
          );

        await cache.put(
          new Request(
            new URL(
              ADMIN,
              self.registration.scope
            )
          ),
          patched.clone()
        );

      }catch(err){

        console.warn(
          'SKMedKART admin cache warm-up failed:',
          err
        );

      }

      await self.skipWaiting();

    })()
  )
);


self.addEventListener('activate',e=>
  e.waitUntil(

    caches.keys()

      .then(keys=>

        Promise.all(

          keys

            .filter(k=>
              k.startsWith('skmedkart-admin-') &&
              k!==CACHE
            )

            .map(k=>
              caches.delete(k)
            )

        )

      )

      .then(()=>
        self.clients.claim()
      )

  )
);


self.addEventListener('fetch',e=>{

  if(e.request.method!=='GET')
    return;

  const url=new URL(e.request.url);


  /*
    admin.js
    Always serve the patched version.
  */

  if(url.pathname.endsWith('/admin.js')){

    const cacheKey=
      new Request(
        new URL(
          ADMIN,
          self.registration.scope
        )
      );

    e.respondWith(

      getPatchedAdminResponse(e.request)

        .then(response=>{

          const copy=response.clone();

          caches.open(CACHE)
            .then(c=>
              c.put(cacheKey,copy)
            )
            .catch(()=>{});

          return response;

        })

        .catch(()=>
          caches.match(cacheKey)
        )

    );

    return;
  }


  /*
    IMPORTANT:
    stock-integrity-v5.9.56.js is intentionally NOT loaded.
    index.html has already been cleaned.
  */


  e.respondWith(

    fetch(e.request)

      .then(response=>{

        const copy=response.clone();

        caches.open(CACHE)
          .then(c=>
            c.put(e.request,copy)
          )
          .catch(()=>{});

        return response;

      })

      .catch(()=>
        caches.match(e.request)
      )

  );

});
