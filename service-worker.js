const CACHE_NAME = 'skmedkart-admin-v2';

const APP_FILES = [
  './',
  './index.html',
  './admin.js',
  './firebase-config.js',
  './manifest.webmanifest'
];


/* INSTALL */

self.addEventListener('install', event => {

  event.waitUntil(

    caches.open(CACHE_NAME)

      .then(cache => {

        return cache.addAll(APP_FILES);

      })

      .then(() => self.skipWaiting())

  );

});


/* ACTIVATE */

self.addEventListener('activate', event => {

  event.waitUntil(

    caches.keys()

      .then(cacheNames => {

        return Promise.all(

          cacheNames.map(cacheName => {

            if (cacheName !== CACHE_NAME) {

              return caches.delete(cacheName);

            }

          })

        );

      })

      .then(() => self.clients.claim())

  );

});


/* FETCH */

self.addEventListener('fetch', event => {

  if (event.request.method !== 'GET') {
    return;
  }


  /*
    முக்கியம்:

    admin.js மற்றும் firebase-config.js
    எப்போதும் NETWORK FIRST.

    இதனால் புதிய code GitHub-ல் update ஆனதும்
    பழைய cached JavaScript பயன்படுத்தப்படாது.
  */

  const url = new URL(event.request.url);


  if (
    url.pathname.endsWith('/admin.js') ||
    url.pathname.endsWith('/firebase-config.js')
  ) {

    event.respondWith(

      fetch(event.request)

        .then(response => {

          const responseClone =
            response.clone();


          caches.open(CACHE_NAME)

            .then(cache => {

              cache.put(
                event.request,
                responseClone
              );

            });


          return response;

        })

        .catch(() => {

          return caches.match(
            event.request
          );

        })

    );


    return;

  }


  /*
    மற்ற files:
    NETWORK FIRST
  */

  event.respondWith(

    fetch(event.request)

      .then(response => {

        const responseClone =
          response.clone();


        caches.open(CACHE_NAME)

          .then(cache => {

            cache.put(
              event.request,
              responseClone
            );

          });


        return response;

      })

      .catch(() => {

        return caches.match(
          event.request
        )

        .then(cachedResponse => {

          return (
            cachedResponse ||
            caches.match('./index.html')
          );

        });

      })

  );

});
