/* SKMedKART V5.9.56 FINAL - deterministic offline stock ledger repair
   Purchase History = IN
   Non-returned Bill History = OUT
   Returned Bill = cancelled sale
   Opening stock without purchase history is preserved.
*/
(function(){
'use strict';

const K='skm_pharmacy_v2_';
const R='skm_stock_reconciled_v9';

let timer=0;
let running=false;

const A=k=>{
  try{
    const v=JSON.parse(
      localStorage.getItem(K+k)||'[]'
    );
    return Array.isArray(v)?v:[];
  }catch{
    return [];
  }
};

const N=v=>
  String(v??'')
    .trim()
    .toLowerCase()
    .replace(/\s+/g,' ');

const Q=v=>{
  const n=Number(v);
  return Number.isFinite(n)&&n>0?n:0;
};


function reconcile(){

  if(running)return false;

  running=true;

  try{

    const products=A('products');
    const purchases=A('purchases');
    const batches=A('batches');
    const bills=A('bills');
    const moves=A('stockMovements');

    if(
      !products.length &&
      !purchases.length &&
      !batches.length &&
      !bills.length
    ){
      return false;
    }


    /* --------------------------------
       PRODUCT RESOLUTION
    -------------------------------- */

    const pById=new Map();
    const pByName=new Map();

    for(const p of products){

      const id=String(p?.id||'');

      if(id)
        pById.set(id,p);

      const name=N(p?.name);

      if(name){

        if(!pByName.has(name))
          pByName.set(name,[]);

        pByName.get(name).push(p);
      }
    }


    const product=(id,name)=>{

      const p=pById.get(
        String(id||'')
      );

      if(p)return p;

      const matches=
        pByName.get(N(name))||[];

      return matches.length===1
        ?matches[0]
        :null;
    };


    /* --------------------------------
       BATCH RESOLUTION
    -------------------------------- */

    const bById=new Map();
    const bByKey=new Map();

    for(const b of batches){

      const id=String(b?.id||'');

      if(id)
        bById.set(id,b);

      const bn=N(
        b?.batchNumber||
        b?.batch
      );

      const pn=N(
        b?.productName||
        b?.medicineName||
        b?.medicine||
        b?.name
      );

      if(bn&&pn){

        const key=
          pn+'__'+bn;

        if(!bByKey.has(key))
          bByKey.set(key,[]);

        bByKey.get(key).push(b);
      }
    }


    const batch=(p,bn,bid)=>{

      if(!p)return null;

      const direct=
        bById.get(
          String(bid||'')
        );

      const wanted=N(bn);

      if(direct){

        const sameProduct=
          String(direct.productId||'')===
            String(p.id||'') ||

          N(
            direct.productName||
            direct.medicineName||
            direct.medicine||
            direct.name
          )===N(p.name);

        if(
          sameProduct &&
          (
            !wanted ||
            N(
              direct.batchNumber||
              direct.batch
            )===wanted
          )
        ){
          return direct;
        }
      }


      if(!wanted)
        return null;


      const key=
        N(p.name)+'__'+wanted;

      const matches=
        bByKey.get(key)||[];

      return matches.length===1
        ?matches[0]
        :null;
    };


    /* --------------------------------
       PURCHASE LEDGER
       PURCHASE = STOCK IN
    -------------------------------- */

    const inQty=new Map();
    const purchaseBatches=new Map();
    const seenPurchase=new Set();


    for(const pu of purchases){

      const purchaseId=
        String(pu?.id||'');

      if(
        purchaseId &&
        seenPurchase.has(purchaseId)
      ){
        continue;
      }

      if(purchaseId)
        seenPurchase.add(purchaseId);


      const q=Q(
        pu?.qty??
        pu?.quantity
      );

      if(!q)
        continue;


      const p=product(
        pu?.productId||
        pu?.productID,

        pu?.productName||
        pu?.medicine||
        pu?.name
      );

      if(!p)
        continue;


      const bn=
        pu?.batchNumber||
        pu?.batch||
        '';


      let b=batch(
        p,
        bn,
        pu?.batchId||''
      );


      /*
        If a purchase has a real batch number
        but the batch record is missing,
        rebuild the batch link.
      */

      if(!b&&bn){

        const bid=
          String(p.id)+'__'+
          String(bn);


        b={
          id:bid,

          productId:
            String(p.id),

          productName:
            p.name||'',

          batchNumber:
            String(bn),

          expiryDate:
            pu?.expiryDate||'',

          stock:0,

          mrp:
            Q(
              pu?.mrp||
              p.mrp||
              p.price
            ),

          sellingPrice:
            Q(
              pu?.sellingPrice||
              p.price
            ),

          purchasePrice:
            Q(
              pu?.purchasePrice
            ),

          purchaseGstRate:
            Q(
              pu?.purchaseGstRate
            ),

          purchasePriceWithGst:
            Q(
              pu?.purchasePriceWithGst
            )
        };


        batches.push(b);

        bById.set(
          bid,
          b
        );
      }


      if(!b)
        continue;


      const bid=
        String(b.id);


      inQty.set(
        bid,
        (inQty.get(bid)||0)+q
      );


      const pid=
        String(p.id);


      if(!purchaseBatches.has(pid))
        purchaseBatches.set(
          pid,
          []
        );


      if(
        !purchaseBatches
          .get(pid)
          .includes(b)
      ){

        purchaseBatches
          .get(pid)
          .push(b);
      }
    }


    /* --------------------------------
       BILL LEDGER
       BILL = STOCK OUT
       RETURNED BILL = NO STOCK OUT
    -------------------------------- */
/* --------------------------------
   BILL LEDGER
   BILL = STOCK OUT
   RETURNED BILL = NO STOCK OUT

   IMPORTANT:
   Same invoice number can contain
   multiple valid sale rows.
   Do NOT discard valid quantities.
-------------------------------- */

const byInvoice=new Map();

for(const bill of bills){

  const key=String(
    bill?.invoiceNumber||
    bill?.id||
    ''
  );

  if(!key)continue;

  if(!byInvoice.has(key)){
    byInvoice.set(key,{
      returned:!!bill?.returned,
      items:[]
    });
  }

  const group=byInvoice.get(key);

  if(bill?.returned){
    group.returned=true;
  }

  for(const it of (bill?.items||[])){

    const q=Q(
      it?.qty??
      it?.quantity
    );

    if(!q)continue;

    /*
      Prevent only exact duplicate item records.
      Different quantities under the same invoice
      are kept as valid sales.
    */

    const sig=[
      String(
        it?.productId||
        it?.productID||
        ''
      ),
      N(
        it?.name||
        it?.productName||
        it?.medicine||
        ''
      ),
      N(
        it?.batchId||
        ''
      ),
      N(
        it?.batchNumber||
        it?.batch||
        ''
      ),
      String(q),
      String(
        Number(
          it?.price||
          it?.sellingPrice||
          it?.rate||
          0
        )
      )
    ].join('|');

    const already=group.items.some(x=>
      x.__stockLedgerSignature===sig
    );

    if(already)continue;

    const copy={
      ...it,
      __stockLedgerSignature:sig
    };

    group.items.push(copy);
  }
}


const sold=new Map();

const addSold=(b,q)=>{

  if(!b||q<=0)return;

  const id=String(b.id);

  sold.set(
    id,
    (sold.get(id)||0)+q
  );
};


/* --------------------------------
   PROCESS ALL VALID BILL ITEMS
-------------------------------- */

for(const bill of byInvoice.values()){

  /*
    Returned bill = sale cancelled.
  */
  if(bill.returned)continue;

  for(const it of bill.items){

    const q=Q(
      it?.qty??
      it?.quantity
    );

    if(!q)continue;

    const p=product(
      it?.productId||
      it?.productID,

      it?.name||
      it?.productName||
      it?.medicine
    );

    if(!p)continue;

    const b=batch(
      p,

      it?.batchNumber||
      it?.batch||
      '',

      it?.batchId||
      ''
    );


    /*
      Exact batch match.
    */

    if(
      b &&
      inQty.has(String(b.id))
    ){

      addSold(b,q);
      continue;
    }


    /*
      Legacy bill:
      missing/wrong batch information.

      Allocate only from the same medicine.
      FEFO = earliest expiry first.
    */

    const candidates=
      (
        purchaseBatches.get(
          String(p.id)
        )||[]
      )
      .slice()
      .sort(
        (x,y)=>
          String(
            x?.expiryDate||
            '9999-12-31'
          ).localeCompare(
            String(
              y?.expiryDate||
              '9999-12-31'
            )
          ) ||

          N(
            x?.batchNumber||
            x?.batch
          ).localeCompare(
            N(
              y?.batchNumber||
              y?.batch
            )
          )
      );


    let left=q;

    for(const c of candidates){

      if(left<=0)break;

      const id=String(c.id);

      const available=Math.max(
        0,
        (inQty.get(id)||0)-
        (sold.get(id)||0)
      );

      const take=Math.min(
        available,
        left
      );

      if(take>0){

        addSold(
          c,
          take
        );

        left-=take;
      }
    }
  }
}


/* --------------------------------
   STOCK ADJUSTMENTS
-------------------------------- */

const adj=new Map();

for(const m of moves){

  const type=String(
    m?.type||
    ''
  ).toUpperCase();

  if(
    type!=='STOCK_ADJUSTMENT' &&
    type!=='ADJUSTMENT'
  ){
    continue;
  }

  const p=product(
    m?.productId||
    m?.productID,

    m?.productName||
    m?.medicine||
    m?.name
  );

  const b=batch(
    p,

    m?.batchNumber||
    m?.batch||
    '',

    m?.batchId||
    ''
  );

  if(!b)continue;

  const id=String(b.id);

  adj.set(
    id,
    (adj.get(id)||0)+
    Number(m?.qty||0)
  );
}
    /* --------------------------------
       STOCK ADJUSTMENTS
    -------------------------------- */

    const adj=new Map();


    for(
      const m
      of moves
    ){

      const type=
        String(
          m?.type||''
        ).toUpperCase();


      if(
        type!=='STOCK_ADJUSTMENT' &&
        type!=='ADJUSTMENT'
      ){
        continue;
      }


      const p=product(
        m?.productId||
        m?.productID,

        m?.productName||
        m?.medicine||
        m?.name
      );


      const b=batch(
        p,

        m?.batchNumber||
        m?.batch||
        '',

        m?.batchId||
        ''
      );


      if(!b)
        continue;


      const id=
        String(b.id);


      adj.set(
        id,
        (adj.get(id)||0)+
        Number(m?.qty||0)
      );
    }


    /* --------------------------------
       REBUILD BATCH STOCK
    -------------------------------- */

    let changed=false;

    const totals=new Map();


    for(
      const b
      of batches
    ){

      const id=
        String(b?.id||'');


      if(!id)
        continue;


      let expected;


      /*
        Purchase-backed batch:
        PURCHASE - SALES + ADJUSTMENTS
      */

      if(
        inQty.has(id)
      ){

        expected=
          Math.max(
            0,

            (inQty.get(id)||0) -
            (sold.get(id)||0) +
            (adj.get(id)||0)
          );

      }else{

        /*
          Opening stock:
          no purchase history.

          Preserve existing physical stock.
        */

        expected=
          Q(b?.stock);
      }


      if(
        Math.abs(
          Number(b.stock||0)-
          expected
        )>0.000001
      ){

        b.stock=
          expected;

        changed=true;
      }


      const pid=
        String(
          b?.productId||''
        );


      if(pid){

        totals.set(
          pid,
          (totals.get(pid)||0)+
          expected
        );
      }
    }


    /* --------------------------------
       PRODUCT MASTER STOCK
       = TOTAL OF BATCH STOCK
    -------------------------------- */

    for(
      const p
      of products
    ){

      const id=
        String(
          p?.id||''
        );


      if(
        !totals.has(id)
      ){
        continue;
      }


      const expected=
        Math.max(
          0,
          totals.get(id)||0
        );


      if(
        Math.abs(
          Number(p.stock||0)-
          expected
        )>0.000001
      ){

        p.stock=
          expected;

        changed=true;
      }
    }


    /* --------------------------------
       SAVE ONLY WHEN SOMETHING CHANGED
    -------------------------------- */

    if(changed){

      localStorage.setItem(
        K+'batches',
        JSON.stringify(batches)
      );

      localStorage.setItem(
        K+'products',
        JSON.stringify(products)
      );
    }


    localStorage.setItem(
      R,
      new Date().toISOString()
    );


    return changed;

  }catch(e){

    console.error(
      'SKMedKART stock reconcile:',
      e
    );

    return false;

  }finally{

    running=false;
  }
}


/* --------------------------------
   WATCH LOCAL STORAGE CHANGES

   admin.js is an ES module.
   Therefore we do NOT depend on
   window.saveBill/savePurchase.
-------------------------------- */

function schedule(){

  clearTimeout(timer);

  timer=setTimeout(
    ()=>{
      reconcile();
    },
    150
  );
}


try{

  const nativeSet=
    Storage.prototype.setItem;


  Storage.prototype.setItem=
    function(key,value){

      const out=
        nativeSet.call(
          this,
          key,
          value
        );


      if(
        this===localStorage &&
        typeof key==='string' &&
        key.startsWith(K) &&
        /^(products|purchases|batches|bills|stockMovements)$/
          .test(
            key.slice(K.length)
          )
      ){

        schedule();
      }


      return out;
    };

}catch(e){

  console.warn(
    'SKMedKART storage hook:',
    e
  );
}


try{

  const nativeRemove=
    Storage.prototype.removeItem;


  Storage.prototype.removeItem=
    function(key){

      const out=
        nativeRemove.call(
          this,
          key
        );


      if(
        this===localStorage &&
        typeof key==='string' &&
        key.startsWith(K) &&
        /^(products|purchases|batches|bills|stockMovements)$/
          .test(
            key.slice(K.length)
          )
      ){

        schedule();
      }


      return out;
    };

}catch(e){}


/* --------------------------------
   PUBLIC MANUAL RECONCILE
-------------------------------- */

window.SKMedKARTStockReconcileV956=
  reconcile;


/* Initial repair */

schedule();

setTimeout(
  schedule,
  1000
);

})();
