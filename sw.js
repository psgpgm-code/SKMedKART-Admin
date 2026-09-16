const CACHE='skmedkart-admin-v5.9.58-stock-ledger-fix';
const ADMIN='./admin.js?v=5.9.50-stock-integrity-full-audit';

function patchAdminSource(text){
  let out=text;

  /* V5.9.58 — safe localStorage writes */
  const oldSet="const get=(k,d)=>{try{return JSON.parse(localStorage.getItem(K+k)||JSON.stringify(d))}catch{return d}},set=(k,v)=>localStorage.setItem(K+k,JSON.stringify(v));";

  const newSet="const get=(k,d)=>{try{return JSON.parse(localStorage.getItem(K+k)||JSON.stringify(d))}catch{return d}},safeSet=(k,v)=>{try{return localStorage.setItem(K+k,JSON.stringify(v))}catch(e){if(e&&e.name==='QuotaExceededError'&&(k==='batches'||k==='products')){console.warn('SKMedKART: derived stock cache write skipped:',k);return false}throw e}},set=(k,v)=>safeSet(k,v);";

  if(out.includes(oldSet)){
    out=out.replace(oldSet,newSet);
  }

  /*
   V5.9.58 STOCK FIX

   Purchase = STOCK IN
   Valid bill = STOCK OUT
   Returned bill = cancelled sale
   Adjustment = explicit adjustment

   IMPORTANT:
   Same invoice number does NOT mean duplicate.
   Example:
   SKM-126 Qty 2
   SKM-126 Qty 1
   BOTH are valid sales and BOTH must be deducted.

   Only an EXACT repeated snapshot is ignored.
  */

  const start=out.indexOf('function repairLocalStockConsistency(){');
  const end=out.indexOf('\nasync function loadAll(',start);

  if(start>=0 && end>start){

    const fixed=`function repairLocalStockConsistency(){

 let changed=false;

 const sm=Array.isArray(get('stockMovements',[]))
   ?get('stockMovements',[]):[];

 const norm=v=>String(v??'')
   .trim().toLowerCase().replace(/\\\\s+/g,' ');

 const qty=v=>{
   const n=Number(v);
   return Number.isFinite(n)&&n>0?n:0;
 };

 /* PRODUCTS */

 const productById=new Map(
   products
     .map(p=>[String(p?.id||''),p])
     .filter(x=>x[0])
 );

 const productsByName=new Map();

 for(const p of products){

   const n=norm(p?.name);

   if(!n)continue;

   if(!productsByName.has(n))
     productsByName.set(n,[]);

   productsByName.get(n).push(p);
 }

 const resolveProduct=(id,name)=>{

   const byId=
     productById.get(String(id||''));

   if(byId)return byId;

   const arr=
     productsByName.get(norm(name))||[];

   return arr.length===1?arr[0]:null;
 };


 /* BATCHES */

 const batchById=new Map(
   batches
     .map(b=>[String(b?.id||''),b])
     .filter(x=>x[0])
 );

 const batchByKey=new Map();

 for(const b of batches){

   const bn=
     norm(b?.batchNumber||b?.batch);

   if(!bn)continue;

   const pid=
     String(b?.productId||'');

   const pn=
     norm(
       b?.productName||
       b?.medicineName||
       b?.medicine||
       b?.name
     );

   if(pid){

     const key=
       'P:'+pid+'|B:'+bn;

     if(!batchByKey.has(key))
       batchByKey.set(key,[]);

     batchByKey.get(key).push(b);
   }

   if(pn){

     const key=
       'N:'+pn+'|B:'+bn;

     if(!batchByKey.has(key))
       batchByKey.set(key,[]);

     batchByKey.get(key).push(b);
   }
 }

 const resolveBatch=(p,bn,bid)=>{

   if(!p)return null;

   const wanted=
     norm(bn);

   const direct=
     batchById.get(String(bid||''));

   if(direct){

     const sameProduct=
       String(direct.productId||'')===
         String(p.id||'') ||

       norm(
         direct.productName||
         direct.medicineName||
         direct.medicine||
         direct.name
       )===norm(p.name);

     const sameBatch=
       !wanted ||
       norm(
         direct.batchNumber||
         direct.batch
       )===wanted;

     if(sameProduct&&sameBatch)
       return direct;
   }

   if(!wanted)return null;

   const byPid=
     batchByKey.get(
       'P:'+String(p.id)+'|B:'+wanted
     )||[];

   if(byPid.length===1)
     return byPid[0];

   const byName=
     batchByKey.get(
       'N:'+norm(p.name)+'|B:'+wanted
     )||[];

   return byName.length===1
     ?byName[0]
     :null;
 };


 /* PURCHASE = STOCK IN */

 const purchaseQtyByBatch=
   new Map();

 const purchaseBatchesByProduct=
   new Map();

 const seenPurchaseIds=
   new Set();

 for(const pu of purchases){

   const purchaseId=
     String(pu?.id||'');

   if(
     purchaseId &&
     seenPurchaseIds.has(purchaseId)
   )continue;

   if(purchaseId)
     seenPurchaseIds.add(purchaseId);

   const q=
     qty(pu?.qty??pu?.quantity);

   if(!q)continue;

   const p=
     resolveProduct(
       pu?.productId||pu?.productID,
       pu?.productName||
       pu?.medicine||
       pu?.name
     );

   if(!p)continue;

   const bn=
     pu?.batchNumber||
     pu?.batch||
     '';

   let b=
     resolveBatch(
       p,
       bn,
       pu?.batchId||''
     );

   /*
    Legacy purchase row whose batch record
    disappeared: recreate the batch safely.
   */

   if(!b&&bn){

     const id=
       String(p.id)+'__'+String(bn);

     b={
       id,
       productId:String(p.id),
       productName:p.name,
       batchNumber:String(bn),
       expiryDate:pu?.expiryDate||'',
       stock:0,
       mrp:Number(
         pu?.mrp||
         p.mrp||
         p.price||
         0
       ),
       sellingPrice:Number(
         pu?.sellingPrice||
         p.price||
         0
       ),
       purchasePrice:Number(
         pu?.purchasePrice||0
       ),
       purchaseGstRate:Number(
         pu?.purchaseGstRate||0
       ),
       purchasePriceWithGst:Number(
         pu?.purchasePriceWithGst||0
       )
     };

     batches.push(b);

     batchById.set(id,b);

     changed=true;
   }

   if(!b)continue;

   const bid=
     String(b.id);

   purchaseQtyByBatch.set(
     bid,
     (purchaseQtyByBatch.get(bid)||0)+q
   );

   const pid=
     String(p.id);

   if(
     !purchaseBatchesByProduct
       .has(pid)
   ){
     purchaseBatchesByProduct
       .set(pid,[]);
   }

   const arr=
     purchaseBatchesByProduct
       .get(pid);

   if(!arr.includes(b))
     arr.push(b);
 }

 /*
  FEFO order for legacy sales where
  batch information is missing.
 */

 for(
   const arr of
   purchaseBatchesByProduct.values()
 ){

   arr.sort(
     (a,b)=>
       String(a.expiryDate||'')
         .localeCompare(
           String(b.expiryDate||'')
         ) ||

       norm(
         a.batchNumber||
         a.batch
       ).localeCompare(
         norm(
           b.batchNumber||
           b.batch
         )
       )
   );
 }


 /*

   BILLS

   DO NOT GROUP BY invoice number.

   The same invoice can legitimately
   have multiple records.

 */

 const uniqueBills=[];

 const seenSnapshots=
   new Set();

 const billSignature=b=>{

   const items=
     Array.isArray(b?.items)
       ?b.items.map(it=>[
           String(
             it?.productId||
             it?.productID||
             ''
           ),

           String(
             it?.batchId||''
           ),

           norm(
             it?.batchNumber||
             it?.batch||
             ''
           ),

           norm(
             it?.name||
             it?.productName||
             it?.medicine||
             ''
           ),

           Number(
             it?.qty??
             it?.quantity??
             0
           ),

           Number(
             it?.price??
             it?.sellingPrice??
             it?.mrp??
             0
           )
         ])
         .sort(
           (a,b)=>
             JSON.stringify(a)
               .localeCompare(
                 JSON.stringify(b)
               )
         )
       :[];

   /*
    ID + invoice + customer/date +
    returned state + complete items.

    Therefore two valid records with
    same invoice but different data
    are NOT merged.
   */

   return JSON.stringify([

     String(b?.id||''),

     String(
       b?.invoiceNumber||''
     ),

     String(
       b?.customerName||''
     ),

     String(
       b?.billDate||
       b?.date||
       b?.createdAt||
       ''
     ),

     !!b?.returned,

     items
   ]);
 };


 for(const bill of bills){

   const sig=
     billSignature(bill);

   if(seenSnapshots.has(sig))
     continue;

   seenSnapshots.add(sig);

   uniqueBills.push(bill);
 }


 /* STOCK OUT */

 const soldByBatch=
   new Map();

 const addSold=(b,q)=>{

   if(!b||q<=0)return;

   const id=
     String(b.id);

   soldByBatch.set(
     id,
     (soldByBatch.get(id)||0)+q
   );
 };


 for(const bill of uniqueBills){

   /*
    Returned bill = no stock deduction.
   */

   if(bill?.returned)
     continue;

   const items=
     Array.isArray(bill?.items)
       ?bill.items
       :[];

   for(const it of items){

     const q=
       qty(
         it?.qty??
         it?.quantity
       );

     if(!q)continue;

     const p=
       resolveProduct(
         it?.productId||
         it?.productID,

         it?.name||
         it?.productName||
         it?.medicine
       );

     if(!p)continue;

     const b=
       resolveBatch(
         p,

         it?.batchNumber||
         it?.batch||
         '',

         it?.batchId||
         ''
       );

     /*
      Normal case:
      exact product + exact batch.
     */

     if(b){

       addSold(b,q);

       continue;
     }

     /*
      Legacy bill without valid batch link.

      Allocate ONLY to the same medicine,
      FEFO, and NEVER exceed purchased
      quantity.
     */

     const arr=
       purchaseBatchesByProduct
         .get(String(p.id))||[];

     let remaining=q;

     for(const candidate of arr){

       if(remaining<=0)
         break;

       const id=
         String(candidate.id);

       const already=
         soldByBatch.get(id)||0;

       const incoming=
         purchaseQtyByBatch.get(id)||0;

       const available=
         Math.max(
           0,
           incoming-already
         );

       const take=
         Math.min(
           available,
           remaining
         );

       if(take>0){

         addSold(
           candidate,
           take
         );

         remaining-=take;
       }
     }
   }
 }


 /* EXPLICIT STOCK ADJUSTMENTS */

 const adjustmentByBatch=
   new Map();

 for(const m of sm){

   const type=
     String(
       m?.type||''
     ).toUpperCase();

   if(
     type!=='STOCK_ADJUSTMENT' &&
     type!=='ADJUSTMENT'
   )continue;

   const p=
     resolveProduct(
       m?.productId||
       m?.productID,

       m?.productName||
       m?.medicine||
       m?.name
     );

   if(!p)continue;

   const b=
     resolveBatch(
       p,

       m?.batchNumber||
       m?.batch||
       '',

       m?.batchId||
       ''
     );

   if(!b)continue;

   const id=
     String(b.id);

   adjustmentByBatch.set(
     id,

     (adjustmentByBatch.get(id)||0)
     +
     Number(m?.qty||0)
   );
 }


 /* FINAL BATCH STOCK */

 const totalByProduct=
   new Map();

 for(const b of batches){

   const id=
     String(b?.id||'');

   if(!id)continue;

   const incoming=
     purchaseQtyByBatch.get(id);

   let expected;

   if(incoming!==undefined){

     /*
      FINAL STOCK

      PURCHASE
      - SOLD
      + ADJUSTMENT
     */

     expected=
       Math.max(
         0,

         incoming
         -
         (soldByBatch.get(id)||0)
         +
         (adjustmentByBatch.get(id)||0)
       );

   }else{

     /*
      No purchase history:
      treat as opening stock.

      DO NOT invent a purchase.
     */

     expected=
       Math.max(
         0,
         Number(b?.stock||0)
       );
   }

   if(
     Math.abs(
       Number(b?.stock||0)
       -
       expected
     )>0.000001
   ){

     b.stock=
       expected;

     changed=true;
   }

   const pid=
     String(b?.productId||'');

   if(pid){

     totalByProduct.set(
       pid,

       (totalByProduct.get(pid)||0)
       +
       expected
     );
   }
 }


 /* PRODUCT TOTAL = SUM OF BATCHES */

 for(const p of products){

   const pid=
     String(p?.id||'');

   if(
     !totalByProduct.has(pid)
   )continue;

   const expected=
     Math.max(
       0,
       totalByProduct.get(pid)||0
     );

   if(
     Math.abs(
       Number(p?.stock||0)
       -
       expected
     )>0.000001
   ){

     p.stock=
       expected;

     changed=true;
   }
 }


 if(changed){

   set(
     'batches',
     batches
   );

   set(
     'products',
     products
   );
 }

 localStorage.setItem(
   'skm_stock_reconciled_v8',
   'yes'
);
}
`;

    out=
      out.slice(0,start)+
      fixed+
      out.slice(end);
  }

  return out;
}


async function getPatchedAdminResponse(request){

  const versioned=
    new Request(
      new URL(
        ADMIN,
        self.registration.scope
      ),
      {
        method:'GET',
        headers:request.headers,
        mode:'same-origin',
        credentials:request.credentials,
        cache:'no-store'
      }
    );

  const response=
    await fetch(versioned);

  const source=
    await response.text();

  const patched=
    patchAdminSource(source);

  return new Response(
    patched,
    {
      status:response.status,
      statusText:response.statusText,
      headers:response.headers
    }
  );
}


self.addEventListener(
  'install',
  e=>
    e.waitUntil(
      (async()=>{

        const cache=
          await caches.open(CACHE);

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
            'SKMedKART cache warm-up failed:',
            err
          );
        }

        await self.skipWaiting();

      })()
    )
);


self.addEventListener(
  'activate',
  e=>
    e.waitUntil(

      caches.keys()

        .then(keys=>

          Promise.all(

            keys

              .filter(
                k=>
                  k.startsWith(
                    'skmedkart-admin-'
                  ) &&
                  k!==CACHE
              )

              .map(
                k=>
                  caches.delete(k)
              )
          )
        )

        .then(
          ()=>
            self.clients.claim()
        )
    )
);


self.addEventListener(
  'fetch',
  e=>{

    if(
      e.request.method!=='GET'
    )return;

    const url=
      new URL(e.request.url);


    if(
      url.pathname.endsWith(
        '/admin.js'
      )
    ){

      const cacheKey=
        new Request(
          new URL(
            ADMIN,
            self.registration.scope
          )
        );

      e.respondWith(

        getPatchedAdminResponse(
          e.request
        )

        .then(response=>{

          const copy=
            response.clone();

          caches.open(CACHE)
            .then(
              c=>
                c.put(
                  cacheKey,
                  copy
                )
            )
            .catch(()=>{});

          return response;
        })

        .catch(
          ()=>
            caches.match(cacheKey)
        )
      );

      return;
    }


    e.respondWith(

      fetch(e.request)

        .then(response=>{

          const copy=
            response.clone();

          caches.open(CACHE)
            .then(
              c=>
                c.put(
                  e.request,
                  copy
                )
            )
            .catch(()=>{});

          return response;
        })

        .catch(
          ()=>
            caches.match(
              e.request
            )
        )
    );
  }
);
