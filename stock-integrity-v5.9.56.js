/* SKMedKART V5.9.56 — deterministic offline stock ledger repair
   Inbound = Purchase History
   Outbound = non-returned Bill History
   Return = returned bill (sale is cancelled)
   Opening stock without purchase history is preserved
   This file is additive: it does not replace admin.js.
*/
(function(){
'use strict';

const KEY='skm_pharmacy_v2_';
const read=(k,d)=>{try{return JSON.parse(localStorage.getItem(KEY+k)||JSON.stringify(d))}catch{return d}};
const write=(k,v)=>localStorage.setItem(KEY+k,JSON.stringify(v));
const list=k=>{const v=read(k,[]);return Array.isArray(v)?v:[]};
const n=v=>String(v??'').trim().toLowerCase().replace(/\s+/g,' ');
const qty=v=>Math.max(0,Number(v)||0);

function reconcileStock(){
  let products=list('products');
  let purchases=list('purchases');
  let batches=list('batches');
  const bills=list('bills');

  if(!products.length && !purchases.length && !batches.length && !bills.length)return false;

  const productById=new Map();
  const productByName=new Map();

  for(const p of products){
    const id=String(p?.id||'');
    if(id)productById.set(id,p);

    const name=n(p?.name);
    if(name){
      if(!productByName.has(name))productByName.set(name,[]);
      productByName.get(name).push(p);
    }
  }

  const resolveProduct=(id,name)=>{
    const p=productById.get(String(id||''));
    if(p)return p;

    const same=productByName.get(n(name))||[];
    return same.length===1?same[0]:null;
  };

  const batchById=new Map();

  for(const b of batches){
    const id=String(b?.id||'');
    if(id)batchById.set(id,b);
  }

  const resolveBatch=(p,batchNumber,batchId)=>{
    if(!p)return null;

    const pid=String(p.id||'');
    const pn=n(p.name);
    const bn=n(batchNumber);

    const direct=batchById.get(String(batchId||''));

    if(direct){
      const sameProduct=
        String(direct.productId||'')===pid ||
        (!!pn &&
        n(
          direct.productName||
          direct.medicineName||
          direct.medicine||
          direct.name
        )===pn);

      const sameBatch=
        !bn ||
        n(direct.batchNumber||direct.batch)===bn;

      if(sameProduct&&sameBatch)return direct;
    }

    if(!bn)return null;

    const matches=batches.filter(b=>{
      const sameProduct=
        String(b.productId||'')===pid ||
        (!!pn &&
        n(
          b.productName||
          b.medicineName||
          b.medicine||
          b.name
        )===pn);

      return sameProduct &&
        n(b.batchNumber||b.batch)===bn;
    });

    return matches.length===1?matches[0]:null;
  };

  /* 1) Purchase ledger -> exact inbound quantity per batch. */

  const purchaseQty=new Map();
  const purchaseBatchesByProduct=new Map();

  for(const pu of purchases){

    const q=qty(pu?.qty??pu?.quantity);

    if(!q)continue;

    const p=resolveProduct(
      pu?.productId||pu?.productID,
      pu?.productName||pu?.medicine||pu?.name
    );

    if(!p)continue;

    const bn=pu?.batchNumber||pu?.batch||'';

    let b=resolveBatch(
      p,
      bn,
      pu?.batchId||''
    );

    /*
      Legacy repair:
      create missing batch link only when purchase
      has a real batch number.
    */

    if(!b && bn){

      const id=String(p.id)+'__'+String(bn);

      b={
        id,
        productId:String(p.id),
        productName:p.name||'',
        batchNumber:String(bn),
        expiryDate:pu?.expiryDate||'',
        stock:0,
        mrp:qty(pu?.mrp||p.mrp||p.price),
        sellingPrice:qty(pu?.sellingPrice||p.price),
        purchasePrice:qty(pu?.purchasePrice),
        purchaseGstRate:qty(pu?.purchaseGstRate),
        purchasePriceWithGst:qty(pu?.purchasePriceWithGst)
      };

      batches.push(b);
      batchById.set(id,b);
    }

    if(!b)continue;

    const bid=String(b.id);

    purchaseQty.set(
      bid,
      (purchaseQty.get(bid)||0)+q
    );

    const pid=String(p.id);

    if(!purchaseBatchesByProduct.has(pid))
      purchaseBatchesByProduct.set(pid,[]);

    if(!purchaseBatchesByProduct.get(pid).includes(b))
      purchaseBatchesByProduct.get(pid).push(b);
  }

  /*
    2) Bill ledger.

    One invoice counts once even if duplicate records exist.
    Returned bill = zero net sale.
  */

  const billsByInvoice=new Map();

  for(const bill of bills){

    const key=String(
      bill?.invoiceNumber||
      bill?.id||
      ''
    );

    if(!key)continue;

    const old=billsByInvoice.get(key);

    if(!old){

      billsByInvoice.set(key,bill);

    }else{

      if((bill?.items||[]).length>
         (old?.items||[]).length){

        billsByInvoice.set(key,bill);

      }else if(bill?.returned){

        old.returned=true;
      }
    }
  }

  const soldByBatch=new Map();

  const addSold=(b,q)=>{

    if(!b||q<=0)return;

    const id=String(b.id);

    soldByBatch.set(
      id,
      (soldByBatch.get(id)||0)+q
    );
  };

  const unresolved=[];

  for(const bill of billsByInvoice.values()){

    if(bill?.returned)continue;

    for(const item of (bill?.items||[])){

      const q=qty(
        item?.qty??
        item?.quantity
      );

      if(!q)continue;

      const p=resolveProduct(
        item?.productId,
        item?.name||
        item?.productName||
        item?.medicine
      );

      const b=resolveBatch(
        p,
        item?.batchNumber||
        item?.batch||
        '',
        item?.batchId||
        ''
      );

      if(b && purchaseQty.has(String(b.id))){

        addSold(b,q);

      }else{

        unresolved.push({
          p,
          q
        });
      }
    }
  }

  /*
    3) Legacy sales with missing/wrong batch IDs.

    Allocate only within same medicine and only against
    purchased quantity.

    FEFO = earliest expiry first.
  */

  for(const row of unresolved){

    if(!row.p)continue;

    const candidates=
      (purchaseBatchesByProduct.get(
        String(row.p.id)
      )||[])
      .slice()
      .sort((a,b)=>
        String(a.expiryDate||'')
          .localeCompare(
            String(b.expiryDate||'')
          ) ||
        String(a.batchNumber||'')
          .localeCompare(
            String(b.batchNumber||'')
          )
      );

    let remaining=row.q;

    for(const b of candidates){

      if(remaining<=0)break;

      const id=String(b.id);

      const purchased=
        purchaseQty.get(id)||0;

      const alreadySold=
        soldByBatch.get(id)||0;

      const available=
        Math.max(
          0,
          purchased-alreadySold
        );

      const take=
        Math.min(
          available,
          remaining
        );

      if(take>0){

        addSold(b,take);

        remaining-=take;
      }
    }
  }

  /*
    4) Explicit stock adjustments.
  */

  const adjustmentByBatch=new Map();

  for(const m of list('stockMovements')){

    const type=
      String(m?.type||'')
        .toUpperCase();

    if(
      type!=='STOCK_ADJUSTMENT' &&
      type!=='ADJUSTMENT'
    )continue;

    const p=resolveProduct(
      m?.productId,
      m?.productName||
      m?.medicine
    );

    const b=resolveBatch(
      p,
      m?.batchNumber||
      m?.batch||
      '',
      m?.batchId||
      ''
    );

    if(!b)continue;

    const id=String(b.id);

    adjustmentByBatch.set(
      id,
      (adjustmentByBatch.get(id)||0)+
      Number(m?.qty||0)
    );
  }

  /*
    5) Rebuild batch stock.
  */

  let changed=false;

  const productTotal=new Map();

  for(const b of batches){

    const id=String(b?.id||'');

    if(!id)continue;

    let expected;

    if(purchaseQty.has(id)){

      expected=Math.max(
        0,
        (purchaseQty.get(id)||0)-
        (soldByBatch.get(id)||0)+
        (adjustmentByBatch.get(id)||0)
      );

      if(
        Math.abs(
          Number(b.stock||0)-
          expected
        )>0.000001
      ){

        b.stock=expected;

        changed=true;
      }

    }else{

      /*
        Opening stock:
        no purchase history means preserve
        existing physical stock.
      */

      expected=qty(b.stock);
    }

    const pid=String(
      b.productId||''
    );

    if(pid){

      productTotal.set(
        pid,
        (productTotal.get(pid)||0)+
        expected
      );
    }
  }

  /*
    6) Product master stock =
       total of its batches.
  */

  for(const p of products){

    const pid=String(
      p?.id||''
    );

    if(!productTotal.has(pid))
      continue;

    const expected=Math.max(
      0,
      productTotal.get(pid)||0
    );

    if(
      Math.abs(
        Number(p.stock||0)-
        expected
      )>0.000001
    ){

      p.stock=expected;

      changed=true;
    }
  }

  if(changed){

    write(
      'batches',
      batches
    );

    write(
      'products',
      products
    );

    localStorage.setItem(
      'skm_stock_reconciled_v8',
      'yes'
    );
  }

  return changed;
}

function tryWrap(name){

  const fn=window[name];

  if(
    typeof fn!=='function'||
    fn.__SKM_V956
  )return;

  const wrapped=async function(){

    const result=
      await fn.apply(
        this,
        arguments
      );

    try{

      reconcileStock();

    }catch(e){

      console.error(
        'SKMedKART stock reconcile:',
        e
      );
    }

    return result;
  };

  wrapped.__SKM_V956=true;

  wrapped.__original=fn;

  window[name]=wrapped;
}

function install(){

  try{

    reconcileStock();

  }catch(e){

    console.error(
      'SKMedKART V5.9.56:',
      e
    );
  }

  /*
    admin.js is a module.
    Its window functions may appear
    after this script executes.
  */

  let tries=0;

  const timer=setInterval(()=>{

    tries++;

    tryWrap('savePurchase');
    tryWrap('saveBill');
    tryWrap('returnBill');

    if(tries>=30){

      clearInterval(timer);

      try{

        reconcileStock();

      }catch(e){}
    }

  },500);

  setTimeout(()=>{

    try{

      reconcileStock();

    }catch(e){}

  },2000);
}

if(
  document.readyState===
  'loading'
){

  document.addEventListener(
    'DOMContentLoaded',
    install,
    {once:true}
  );

}else{

  install();
}

window.SKMedKARTStockReconcileV956=
  reconcileStock;

})();
