// V5.9.3 permanent login load fix: repaired JavaScript syntax error that prevented the entire admin.js module from loading.

// V5.8 all-fixed release: clear obsolete client-only cache keys once.
// Live Firebase data is not deleted by this code.
try{
  if(localStorage.getItem('skmedkart_release')!=='v5.9-restock-discount-reminder'){
    ['bills','orders','products','batches','purchases','customers','reminders','stockMovements','suppliers'].forEach(k=>localStorage.removeItem(k));
    localStorage.setItem('skmedkart_release','v5.9-restock-discount-reminder');
  }
}catch(e){}

const K='skm_pharmacy_v2_';
let initializeApp,getAuth,signInWithEmailAndPassword,onAuthStateChanged,signOut,getFirestore,collection,onSnapshot,doc,updateDoc,serverTimestamp,addDoc,setDoc,runTransaction,getDocs,writeBatch,deleteDoc;
let firebaseReadyPromise=null;
// Robust Firebase config fallback: keeps login working even if an old PWA cache serves a stale/missing firebase-config.js.
const BUILTIN_FIREBASE_CONFIG={apiKey:'AIzaSyBdvOUiTVoBJHPE418iZqNzYftiN9yjooA',authDomain:'skmedkart.firebaseapp.com',projectId:'skmedkart',storageBucket:'skmedkart.firebasestorage.app',messagingSenderId:'921893232974',appId:'1:921893232974:web:e7fab8eae5eaaec6597e1f'};
const externalCfg=window.SKMED_FIREBASE_CONFIG||{};
const cfg=(externalCfg&&externalCfg.projectId&&!String(externalCfg.projectId).startsWith('PASTE_'))?externalCfg:BUILTIN_FIREBASE_CONFIG;
const admins=window.SKMED_ADMIN_EMAILS||[];
const configured=!!(cfg.apiKey&&cfg.authDomain&&cfg.projectId);
let db=null,auth=null,currentOrders=[],products=[],purchases=[],batches=[],bills=[],customers=[],reminders=[],suppliers=[],liveStarted=false,billCart=[],sourceOrderId='',discountType='flat';
let scheduleFilter='H';
async function ensureFirebase(){
  if(!configured)return false;
  if(db&&auth)return true;
  if(!firebaseReadyPromise){
    firebaseReadyPromise=(async()=>{
      const [appMod,authMod,fsMod]=await Promise.all([
        import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js'),
        import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js')
      ]);
      initializeApp=appMod.initializeApp;
      ({getAuth,signInWithEmailAndPassword,onAuthStateChanged,signOut}=authMod);
      ({getFirestore,collection,onSnapshot,doc,updateDoc,serverTimestamp,addDoc,setDoc,runTransaction,getDocs,writeBatch,deleteDoc}=fsMod);
      const app=initializeApp(cfg);db=getFirestore(app);auth=getAuth(app);
      onAuthStateChanged(auth,u=>{
        if(!u){if(loginOpening)return;$('panel')?.classList.add('hidden');$('bottomNav')?.classList.add('hidden');$('loginCard')?.classList.remove('hidden');return}
        const allowed=admins.map(normalizeEmail);
        if(allowed.length&&!allowed.includes(normalizeEmail(u.email))){loginMessage('❌ This account is not authorized as admin.','error');return signOut(auth)}
        if($('panel')?.classList.contains('hidden'))showPanel();
      });
      return true;
    })().catch(e=>{firebaseReadyPromise=null;throw e});
  }
  return firebaseReadyPromise;
}


const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));
const get=(k,d)=>{try{return JSON.parse(localStorage.getItem(K+k)||JSON.stringify(d))}catch{return d}},set=(k,v)=>localStorage.setItem(K+k,JSON.stringify(v));
const t=v=>v?.toDate?v.toDate().getTime():new Date(v||0).getTime(); const today=()=>new Date().toISOString().slice(0,10); const money=n=>'₹'+Number(n||0).toFixed(2); const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
$('notice').innerHTML=configured?'<b>☁️ Live Firebase mode</b><br><span class="small">Billing, purchases, batches and stock are synchronized.</span>':'<b>📱 Demo mode</b><br><span class="small">Data is stored only in this browser.</span>';
function loginMessage(text,type='info'){const el=$('loginMessage');if(!el)return;el.textContent=text;el.className='loginMessage '+type}
function clearLoginMessage(){const el=$('loginMessage');if(el){el.textContent='';el.className='loginMessage hidden'}}
function normalizeEmail(v){return String(v||'').trim().toLowerCase()}
function showPanel(){
  try{
    clearLoginMessage();
    const login=$('loginCard'),panel=$('panel'),nav=$('bottomNav');
    if(!login||!panel||!nav)throw new Error('Login screen elements are missing.');
    login.classList.add('hidden');
    panel.classList.remove('hidden');
    nav.classList.remove('hidden');
    // Opening the panel must never depend on Firestore finishing successfully.
    Promise.resolve(loadAll()).catch(e=>{console.error('Dashboard load error:',e);const n=$('notice');if(n)n.innerHTML='<b>⚠️ Dashboard opened, but some Firebase data could not load.</b><br><span class="small">'+esc(e?.message||'Check Firebase rules and internet connection.')+'</span>'});
  }catch(e){console.error('Open panel error:',e);loginMessage('❌ Login succeeded but the dashboard could not open: '+(e?.message||'Unknown error'),'error');throw e}
}
window.togglePasswordVisibility=()=>{const p=$('password'),b=$('togglePassword');if(!p)return;const show=p.type==='password';p.type=show?'text':'password';if(b){b.textContent=show?'🙈':'👁️';b.setAttribute('aria-label',show?'Hide password':'Show password')}};
function loginErrorMessage(e){
  const code=String(e?.code||'');
  if(code==='auth/invalid-credential'||code==='auth/wrong-password')return '❌ Wrong password. Please check your password and try again.';
  if(code==='auth/user-not-found')return '❌ This email is not registered.';
  if(code==='auth/invalid-email')return '❌ Please enter a valid email address.';
  if(code==='auth/user-disabled')return '❌ This admin account has been disabled.';
  if(code==='auth/too-many-requests')return '⚠️ Too many failed attempts. Please wait a few minutes and try again.';
  if(code==='auth/network-request-failed')return '⚠️ Internet connection problem. Please check your network and try again.';
  if(code==='auth/operation-not-allowed')return '❌ Email/password login is not enabled in Firebase Authentication.';
  if(code==='auth/unauthorized-domain')return '❌ This website domain is not authorized in Firebase Authentication.';
  return '❌ Login failed: '+(e?.message||code||'Please check your email and password.')
}
let loginOpening=false;
window.adminLogin=async()=>{
  const em=normalizeEmail($('email')?.value),pw=$('password')?.value||'',btn=$('loginBtn');
  clearLoginMessage();
  if(!em){loginMessage('⚠️ Please enter your admin email.','error');$('email')?.focus();return}
  if(!pw){loginMessage('⚠️ Please enter your password.','error');$('password')?.focus();return}
  if(!configured){
    if(em==='admin@skmedkart.local'&&pw==='1234'){loginMessage('✓ Login successful. Opening admin panel...','success');showPanel();return}
    loginMessage('❌ Wrong email or password. Demo login: admin@skmedkart.local / 1234','error');return
  }
  if(loginOpening)return;
  try{
    loginOpening=true;
    if(btn){btn.disabled=true;btn.textContent='Logging in...'}
    loginMessage('Connecting to Firebase...','info');
    await ensureFirebase();
    loginMessage('Checking your login details...','info');
    const credential=await signInWithEmailAndPassword(auth,em,pw);
    const user=credential?.user;
    if(!user)throw new Error('Firebase did not return a signed-in user.');
    const allowed=admins.map(normalizeEmail);
    if(allowed.length&&!allowed.includes(normalizeEmail(user.email))){
      await signOut(auth);
      loginMessage('❌ This account is not authorized as admin.','error');return
    }
    // Do not wait for auth-state or Firestore callbacks. Open the dashboard now.
    showPanel();
  }catch(e){
    console.error('Login error:',e);
    loginMessage(loginErrorMessage(e),'error');
  }finally{
    loginOpening=false;
    if(btn){btn.disabled=false;btn.textContent='Login'}
  }
};
window.adminLogout=()=>{
  const close=()=>{$('panel')?.classList.add('hidden');$('bottomNav')?.classList.add('hidden');$('loginCard')?.classList.remove('hidden')};
  if(configured)signOut(auth).catch(e=>console.error('Logout error:',e)).finally(close);else close();
};
['email','password'].forEach(id=>$(id)?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();window.adminLogin()}}));
for(const b of document.querySelectorAll('.tab'))b.onclick=()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));b.classList.add('active');document.querySelectorAll('.view').forEach(x=>x.classList.add('hidden'));$(b.dataset.view).classList.remove('hidden')};for(const b of document.querySelectorAll('.payBtn'))b.onclick=()=>{document.querySelectorAll('.payBtn').forEach(x=>x.classList.remove('active'));b.classList.add('active');$('bPayment').value=b.dataset.pay};
async function loadAll(force=false){if(!configured){products=get('products',[]);currentOrders=get('orders',[]);purchases=get('purchases',[]);batches=get('batches',[]);bills=get('bills',[]);customers=get('customers',[]);reminders=get('reminders',[]);suppliers=get('suppliers',[]);renderAll();return}if(liveStarted&&!force){renderAll();return}if(force){location.reload();return}liveStarted=true;const listen=(name,assign)=>onSnapshot(collection(db,name),s=>{assign(s.docs.map(d=>({id:d.id,...d.data()})));renderAll()},e=>{console.error('Firebase '+name+' error:',e);const n=$('notice');if(n)n.innerHTML='<b>⚠️ Firebase '+esc(name)+' sync error</b><br><span class="small">'+esc(e.message||'Please check Firebase rules and refresh.')+'</span>'});listen('orders',v=>currentOrders=v.sort((a,b)=>t(b.createdAt)-t(a.createdAt)));listen('products',v=>products=v);listen('purchases',v=>purchases=v.sort((a,b)=>t(b.createdAt)-t(a.createdAt)));listen('batches',v=>batches=v);listen('bills',v=>bills=v.sort((a,b)=>t(b.createdAt)-t(a.createdAt)));listen('customers',v=>customers=v);listen('reminders',v=>reminders=v.sort((a,b)=>t(a.reminderDate)-t(b.reminderDate)));listen('suppliers',v=>suppliers=v)} window.loadAll=loadAll;
function renderAll(){if($('puDate')&&!$('puDate').value)$('puDate').value=today();renderDashboard();renderMedicineCheck();renderBilling();renderPurchases();renderBatches();renderOrders();renderStock();renderBillHistory();renderReports();renderScheduleList();renderReminders();renderSuppliers();renderSelects()}
function renderMedicineCheck(){
 const r=$('mcResult'); if(!r)return;
 if(!r.dataset.initialized) r.innerHTML='<div class="small">Search any medicine to check availability.</div>';
 r.dataset.initialized='1';
}
window.checkMedicineAvailability=()=>{
 const input=$('mcSearch'); const result=$('mcResult'); if(!input||!result)return;
 const q=input.value.trim(); if(!q){result.innerHTML='<div class="warning">Enter a medicine name.</div>';return}
 const exact=findMedicineBySearch(q);
 const list=exact?[exact]:medicineMatches(q);
 if(!list.length){result.innerHTML='<div class="zero"><b>❌ Medicine not found</b><br><span class="small">No matching medicine is in the current stock list.</span></div>';return}
 result.innerHTML=list.map(p=>{
   const usable=batches.filter(b=>b.productId===p.id&&Number(b.stock||0)>0&&expiryStatus(b)!=='EXPIRED');
   const qty=usable.reduce((sum,b)=>sum+Number(b.stock||0),0);
   const near=usable.filter(b=>expiryStatus(b)==='NEAR EXPIRY').length;
   const status=qty>0?'Available':'Out of Stock';
   const batchText=usable.length?usable.sort((a,b)=>t(a.expiryDate)-t(b.expiryDate)).map(b=>'<div class="small">Batch '+esc(b.batchNumber||'-')+' • Exp '+esc(b.expiryDate||'-')+' • Stock '+Number(b.stock||0)+'</div>').join(''):'<div class="small">No saleable batch stock available.</div>';
   return '<div class="'+(qty>0?'good':'zero')+'"><b>'+esc(p.name||'Medicine')+'</b><span class="pill '+(qty>0?'':'bad')+'">'+status+(qty>0?' ✅':' ❌')+'</span><div style="margin-top:8px"><b>Current available stock: '+qty+'</b>'+(near?'<br><span class="small">⚠️ '+near+' batch(es) near expiry</span>':'')+'</div><div style="margin-top:8px">'+batchText+'</div></div>';
 }).join('');
};
function expiryStatus(b){const x=t(b.expiryDate),now=Date.now(),soon=now+30*864e5;return !x?'NO EXPIRY':x<now?'EXPIRED':x<=soon?'NEAR EXPIRY':'OK'}
function renderDashboard(){const low=products.filter(p=>Number(p.stock||0)<=Number(p.lowStockLevel??10)),zero=products.filter(p=>Number(p.stock||0)<=0),exp=batches.filter(b=>['EXPIRED','NEAR EXPIRY'].includes(expiryStatus(b)));const sales=bills.filter(b=>!b.returned&&String(b.billDate||'')===today()).reduce((s,b)=>s+Number(b.grandTotal||0),0);$('lowCount').textContent=low.length;$('expiryCount').textContent=exp.length;$('salesCount').textContent=money(sales);const bc=$('batchCount');if(bc)bc.textContent=batches.length;const alerts=[...zero.map(p=>'OUT OF STOCK: '+p.name),...low.filter(p=>Number(p.stock)>0).map(p=>'LOW STOCK: '+p.name+' ('+p.stock+')'),...exp.map(b=>expiryStatus(b)+': '+(b.productName||b.productId)+' • Batch '+(b.batchNumber||'-')+' • '+b.expiryDate)];$('alerts').innerHTML=alerts.map(x=>'<div class="warning">'+esc(x)+'</div>').join('')||'<div class="good">No urgent stock or expiry alerts.</div>';$('recentBills').innerHTML=bills.slice(0,10).map(b=>billRow(b,true)).join('')||'<div class="small">No bills yet.</div>'}
function renderSelects(){
 const selected=$('bMedicine').value,selectedPu=$('puProduct').value;
 const billSearch=$('bMedicineSearch'),purchaseSearch=$('puProductSearch');
 const currentBill=products.find(p=>p.id===selected);
 const currentPurchase=products.find(p=>p.id===selectedPu);
 if(currentBill&&billSearch)billSearch.value=currentBill.name;
 if(currentPurchase&&purchaseSearch)purchaseSearch.value=currentPurchase.name;
 const dl=$('supplierOptions');
 if(dl)dl.innerHTML=suppliers.map(x=>'<option value="'+esc(x.name)+'">'+esc(x.mobile||'')+'</option>').join('');
 updateBatchOptions();
}
function findMedicineBySearch(value){
 const q=String(value||'').trim().toLowerCase(); if(!q)return null;
 const exact=products.find(p=>String(p.name||'').trim().toLowerCase()===q); if(exact)return exact;
 const starts=products.filter(p=>String(p.name||'').trim().toLowerCase().startsWith(q)); if(starts.length===1)return starts[0];
 const contains=products.filter(p=>String(p.name||'').trim().toLowerCase().includes(q)); return contains.length===1?contains[0]:null;
}
function medicineMatches(q){
 q=String(q||'').trim().toLowerCase();
 if(!q)return products.slice(0,30);
 return products.filter(p=>String(p.name||'').toLowerCase().includes(q)).slice(0,30);
}
function showMedicineSuggestions(inputId,boxId,onPick){
 const input=$(inputId),box=$(boxId); if(!input||!box)return;
 const render=()=>{
   const list=medicineMatches(input.value);
   if(!list.length){box.innerHTML='<div class="medicineOption"><small>No medicine found</small></div>';box.classList.add('show');return}
   box.innerHTML=list.map(p=>'<div class="medicineOption" data-id="'+esc(p.id)+'"><b>'+esc(p.name)+'</b><small>Available stock: '+Number(p.stock||0)+'</small></div>').join('');
   box.querySelectorAll('.medicineOption[data-id]').forEach(el=>el.addEventListener('pointerdown',e=>{
      e.preventDefault(); const p=products.find(x=>x.id===el.dataset.id); if(!p)return;
      input.value=p.name; box.classList.remove('show'); onPick(p);
   }));
   box.classList.add('show');
 };
 input.addEventListener('input',()=>{onPick(null);render()});
 input.addEventListener('focus',render);
 input.addEventListener('keydown',e=>{if(e.key==='Escape')box.classList.remove('show')});
 document.addEventListener('pointerdown',e=>{if(!box.contains(e.target)&&e.target!==input)box.classList.remove('show')});
 input.addEventListener('change',()=>{const p=findMedicineBySearch(input.value);if(p){onPick(p);input.value=p.name}else onPick(null)});
}
function pickBillMedicine(p){
 $('bMedicine').value=p?p.id:'';
 updateBatchOptions();
 if(p)$('bPrice').value=Number(p.price||0);
}
function pickPurchaseMedicine(p){
 $('puProduct').value=p?p.id:'';
 if($('puProductSearch'))$('puProductSearch').dataset.productFound=p?'yes':'no';
 if(p&&$('puCategory'))$('puCategory').value=p.cat||'Human Medicines';
 if($('puSchedule'))$('puSchedule').value=String(p?.schedule||'').toUpperCase().replace('SCHEDULE ','');
}
function syncBillMedicine(){pickBillMedicine(findMedicineBySearch($('bMedicineSearch').value))}
function syncPurchaseMedicine(){pickPurchaseMedicine(findMedicineBySearch($('puProductSearch').value))}
showMedicineSuggestions('bMedicineSearch','bMedicineSuggest',pickBillMedicine);
showMedicineSuggestions('puProductSearch','puMedicineSuggest',pickPurchaseMedicine);
showMedicineSuggestions('mcSearch','mcSuggest',p=>{if(p){$('mcSearch').value=p.name;window.checkMedicineAvailability()}});
$('mcSearch')?.addEventListener('input',()=>{if($('mcSearch').value.trim())window.checkMedicineAvailability();else if($('mcResult'))$('mcResult').innerHTML='<div class="small">Search any medicine to check availability.</div>'});
window.updateBatchOptions=()=>{const pid=$('bMedicine').value;const bs=batches.filter(b=>b.productId===pid&&Number(b.stock||0)>0&&expiryStatus(b)!=='EXPIRED').sort((a,b)=>t(a.expiryDate)-t(b.expiryDate));$('bBatch').innerHTML='<option value="">Select batch</option>'+bs.map(b=>'<option value="'+esc(b.id)+'">'+esc(b.batchNumber)+' • Exp '+esc(b.expiryDate)+' • Stock '+Number(b.stock||0)+'</option>').join('')};$('bBatch').addEventListener('change',()=>{const b=batches.find(x=>x.id===$('bBatch').value);if(b)$('bPrice').value=Number(b.sellingPrice||products.find(p=>p.id===b.productId)?.price||0)});
window.addBillItem=()=>{if(!$('bMedicine').value){const typed=findMedicineBySearch($('bMedicineSearch').value);if(typed)pickBillMedicine(typed)}const pid=$('bMedicine').value,bid=$('bBatch').value,qty=Math.max(1,Number($('bQty').value)||1),price=Math.max(0,Number($('bPrice').value)||0);const p=products.find(x=>x.id===pid),b=batches.find(x=>x.id===bid);if(!p||!b)return alert('Select medicine and batch.');if(expiryStatus(b)==='EXPIRED')return alert('Expired batch cannot be billed.');const already=billCart.filter(x=>x.batchId===bid).reduce((s,x)=>s+x.qty,0);if(Number(b.stock||0)<already+qty)return alert('Insufficient batch stock.');billCart.push({productId:pid,name:p.name,batchId:bid,batchNumber:b.batchNumber,expiryDate:b.expiryDate,qty,price});renderBilling()};
/* Bill discount can be either a flat rupee amount or a percentage. */
window.setDiscountType=(type)=>{
  discountType=type==='percent'?'percent':'flat';
  const flat=$('discountFlatBtn'),percent=$('discountPercentBtn'),label=$('discountInputLabel'),input=$('bDiscount');
  if(flat)flat.classList.toggle('active',discountType==='flat');
  if(percent)percent.classList.toggle('active',discountType==='percent');
  if(label)label.textContent=discountType==='percent'?'Discount (%)':'Discount (₹)';
  if(input){input.placeholder=discountType==='percent'?'0 - 100':'0';input.max=discountType==='percent'?'100':'';}
  renderBilling();
};
window.setGstRate=()=>{const input=$('bGst');if(!input)return;const value=prompt('Enter GST %',input.value||'0');if(value===null)return;const rate=Math.max(0,Number(value)||0);input.value=rate;renderBilling()};
function billTotals(items=billCart){
 const sub=items.reduce((sum,x)=>sum+Number(x.qty||0)*Number(x.price||0),0);
 const discInput=$('bDiscount'),gstInput=$('bGst');
 const legacyDiscount=items.reduce((sum,x)=>sum+Number(x.discount||0),0);
 const rawDiscount=Math.max(0,discInput?Number(discInput.value||0):legacyDiscount);
 const discountRate=discountType==='percent'?Math.min(100,rawDiscount):0;
 const discount=discountType==='percent'
   ?Math.min(sub,sub*discountRate/100)
   :Math.min(sub,rawDiscount);
 const gstRate=Math.max(0,gstInput?Number(gstInput.value||0):0);
 const taxable=Math.max(0,sub-discount);
 const gst=taxable*gstRate/100;
 return {subtotal:sub,discount,discountType,discountInput:rawDiscount,discountRate,gst,gstRate,grandTotal:taxable+gst}
}
function renderBilling(){const pv=$('billPreview');if(pv)pv.textContent='SKM-'+today().replaceAll('-','')+'-NEW';const z=billTotals();$('bSub').textContent=money(z.subtotal);$('bDisc').textContent=money(z.discount);$('bTax').textContent=money(z.gst);$('bTotal').textContent=money(z.grandTotal);$('billItems').innerHTML=billCart.map((x,i)=>'<div class="itemrow"><b>'+esc(x.name)+'</b><br><span class="small">Batch '+esc(x.batchNumber)+' • '+x.qty+' × '+money(x.price)+' • Exp '+esc(x.expiryDate)+'</span><button class="danger" style="width:auto;float:right" onclick="removeBillItem('+i+')">Remove</button></div>').join('')||'<div class="small">No items added.</div>'} window.removeBillItem=i=>{billCart.splice(i,1);renderBilling()};
window.clearBill=()=>{billCart=[];sourceOrderId='';$('bCustomer').value='';$('bMobile').value='';$('bDoctor').value='';$('bNote').value='';$('bDiscount').value=0;$('bGst').value=0;window.setDiscountType('flat');renderBilling()};
/* Live billing total update when Discount ₹ or GST % changes */
window.recalculateBillTotals=()=>renderBilling();
['bDiscount','bGst'].forEach(id=>{const el=$(id);if(el){el.addEventListener('input',renderBilling);el.addEventListener('change',renderBilling);el.addEventListener('keyup',renderBilling);}});
window.saveBill=async()=>{if(!billCart.length)return alert('Add at least one item.');const totals=billTotals(),customerName=$('bCustomer').value.trim()||'Walk-in Customer',mobile=$('bMobile').value.trim(),doctor=$('bDoctor').value.trim(),paymentMode=$('bPayment').value,note=$('bNote').value.trim();let invoiceNumber='';const items=billCart.map(x=>({...x}));const bill={invoiceNumber,customerName,mobile,doctor,paymentMode,note,items,...totals,billDate:today(),sourceOrderId:sourceOrderId||''};const sourceOrder=sourceOrderId?currentOrders.find(x=>x.id===sourceOrderId):null;const useReservedStock=!!(sourceOrder&&orderHasStockReservation(sourceOrder)&&!sourceOrder.stockRestored);try{if(configured){const snap=await getDocs(collection(db,'bills'));let max=0;snap.docs.forEach(d=>{const n=String(d.data()?.invoiceNumber||'').match(/^SKM-(\d+)$/);if(n)max=Math.max(max,Number(n[1])||0)});invoiceNumber='SKM-'+String(max+1).padStart(3,'0')}else{const nums=bills.map(b=>{const m=String(b.invoiceNumber||'').match(/^SKM-(\d+)$/);return m?Number(m[1])||0:0});invoiceNumber='SKM-'+String(Math.max(0,...nums)+1).padStart(3,'0')}bill.invoiceNumber=invoiceNumber;if(configured){if(useReservedStock){await runTransaction(db,async tx=>{const or=doc(db,'orders',sourceOrderId),os=await tx.get(or);if(!os.exists())throw Error('Order not found.');const live=os.data();if(live.stockRestored)throw Error('This order stock was restored after cancellation.');tx.set(doc(collection(db,'bills')),{...bill,usedReservedOrderStock:true,createdAt:serverTimestamp()});if(mobile)tx.set(doc(db,'customers',mobile),{name:customerName,mobile,lastDoctor:doctor,lastPurchaseDate:today(),lastBillNumber:invoiceNumber,updatedAt:serverTimestamp()},{merge:true});tx.update(or,{status:'Billed',billed:true,billNumber:invoiceNumber,billedAt:serverTimestamp(),stockConsumed:true,updatedAt:serverTimestamp()});});}else{const batchIds=[...new Set(items.map(x=>x.batchId))],productIds=[...new Set(items.map(x=>x.productId))];await runTransaction(db,async tx=>{const batchRefs=batchIds.map(id=>doc(db,'batches',id)),productRefs=productIds.map(id=>doc(db,'products',id));const snaps=await Promise.all([...batchRefs,...productRefs].map(r=>tx.get(r)));const batchMap=new Map(),prodMap=new Map();batchRefs.forEach((r,i)=>batchMap.set(r.id,snaps[i]));productRefs.forEach((r,i)=>prodMap.set(r.id,snaps[batchRefs.length+i]));const batchQty=new Map(),prodQty=new Map();for(const it of items){batchQty.set(it.batchId,(batchQty.get(it.batchId)||0)+it.qty);prodQty.set(it.productId,(prodQty.get(it.productId)||0)+it.qty)}for(const [id,qty] of batchQty){const s=batchMap.get(id);if(!s?.exists())throw Error('Batch not found.');const d=s.data();if(expiryStatus(d)==='EXPIRED')throw Error('Expired batch: '+d.batchNumber);if(Number(d.stock||0)<qty)throw Error('Insufficient stock in batch '+d.batchNumber)}for(const [id,qty] of prodQty){const s=prodMap.get(id);if(!s?.exists())throw Error('Product not found.');if(Number(s.data().stock||0)<qty)throw Error('Product stock mismatch. Please check purchase/stock.')}for(const [id,qty] of batchQty){const s=batchMap.get(id);tx.update(doc(db,'batches',id),{stock:Number(s.data().stock||0)-qty,updatedAt:serverTimestamp()})}for(const [id,qty] of prodQty){const s=prodMap.get(id);tx.update(doc(db,'products',id),{stock:Number(s.data().stock||0)-qty,updatedAt:serverTimestamp()})}for(const it of items)tx.set(doc(collection(db,'stockMovements')),{type:'SALE',productId:it.productId,batchId:it.batchId,batchNumber:it.batchNumber,qty:-it.qty,reference:invoiceNumber,createdAt:serverTimestamp()});tx.set(doc(collection(db,'bills')),{...bill,createdAt:serverTimestamp()});if(mobile)tx.set(doc(db,'customers',mobile),{name:customerName,mobile,lastDoctor:doctor,lastPurchaseDate:today(),lastBillNumber:invoiceNumber,updatedAt:serverTimestamp()},{merge:true})})}}else{for(const it of items){const b=batches.find(x=>x.id===it.batchId),p=products.find(x=>x.id===it.productId);if(!b||!p||b.stock<it.qty||p.stock<it.qty)throw Error('Insufficient stock');b.stock-=it.qty;p.stock-=it.qty}bill.id='B'+Date.now();bills.unshift(bill);set('bills',bills);set('batches',batches);set('products',products);const sm=get('stockMovements',[]);sm.push(...items.map(it=>({id:'SM'+Date.now()+Math.random(),type:'SALE',productId:it.productId,batchId:it.batchId,batchNumber:it.batchNumber,qty:-it.qty,reference:invoiceNumber,createdAt:new Date().toISOString()})));set('stockMovements',sm);if(mobile){customers=customers.filter(c=>c.mobile!==mobile);customers.push({name:customerName,mobile,lastDoctor:doctor,lastPurchaseDate:today(),lastBillNumber:invoiceNumber});set('customers',customers)}}if(sourceOrderId){try{if(configured){await updateDoc(doc(db,'orders',sourceOrderId),{status:'Billed',billed:true,billNumber:invoiceNumber,billedAt:serverTimestamp(),updatedAt:serverTimestamp()});}else{const o=currentOrders.find(x=>x.id===sourceOrderId);if(o){o.status='Billed';o.billed=true;o.billNumber=invoiceNumber;o.billedAt=new Date().toISOString();set('orders',currentOrders);}}}catch(orderErr){console.warn('Bill saved, but order status update failed:',orderErr.message)}}alert('Bill saved: '+invoiceNumber);billCart=[];sourceOrderId='';['bCustomer','bMobile','bDoctor','bNote'].forEach(id=>$(id).value='');renderAll();window.showBillActions?.(bill)}catch(e){alert('Could not save bill: '+e.message)}};
function shopHeaderHtml(){
return '<div style="text-align:center;border:1px solid #333;padding:12px;margin-bottom:14px"><div style="font-size:22px;font-weight:700">Sri Krishna Medicals</div><div>Kaveri Road, Pennagaram, Dharmapuri District, Tamil Nadu</div><div>Phone: 8300363317</div><div>Drug Licence No: TN/DPI/01386/20,21<br>FSSAI Licence No: 22422039000512</div></div>'
}
function billHtml(b){return '<!doctype html><html><head><meta charset="utf-8"><title>'+esc(b.invoiceNumber)+'</title><style>body{font-family:Arial;padding:20px;max-width:760px;margin:auto;color:#222}table{width:100%;border-collapse:collapse}th,td{border:1px solid #333;padding:7px;text-align:left}.r{text-align:right}.totals{margin-top:14px;border-top:1px solid #333;padding-top:8px}.grand{font-size:20px;font-weight:700}</style></head><body>'+shopHeaderHtml()+'<h3 style="text-align:center;margin:8px 0">Invoice '+esc(b.invoiceNumber)+'</h3><p><b>Date:</b> '+esc(b.billDate)+'<br><b>Customer:</b> '+esc(b.customerName)+'<br><b>Mobile:</b> '+esc(b.mobile||'-')+'<br><b>Prescribed By:</b> '+esc(b.doctor||'-')+'</p><table><tr><th>Medicine</th><th>Batch</th><th>Qty</th><th>Rate</th><th>Amount</th></tr>'+b.items.map(i=>'<tr><td>'+esc(i.name)+'</td><td>'+esc(i.batchNumber)+'</td><td>'+i.qty+'</td><td>'+money(i.price)+'</td><td>'+money(i.qty*i.price)+'</td></tr>').join('')+'</table><div class="totals">Subtotal: '+money(b.subtotal)+'<br>Discount: '+money(b.discount)+'<br>GST: '+money(b.gst)+'<br><span class="grand">Grand Total: '+money(b.grandTotal)+'</span></div><p><b>Payment:</b> '+esc(b.paymentMode)+'<br><b>Note:</b> '+esc(b.note||'-')+'</p></body></html>'}
function findBill(id){return bills.find(b=>b.id===id||b.invoiceNumber===id)}
window.printBill=id=>{const b=typeof id==='object'?id:findBill(id);if(!b)return alert('Bill not found.');const html=billHtml(b);let frame=document.getElementById('printFrame');if(frame)frame.remove();frame=document.createElement('iframe');frame.id='printFrame';frame.style.position='fixed';frame.style.width='1px';frame.style.height='1px';frame.style.border='0';frame.style.opacity='0';document.body.appendChild(frame);const docx=frame.contentDocument||frame.contentWindow.document;docx.open();docx.write(html);docx.close();frame.onload=()=>{setTimeout(()=>{try{frame.contentWindow.focus();frame.contentWindow.print()}catch(e){const w=window.open('','_blank');if(!w)return alert('Please allow popups for printing.');w.document.write(html);w.document.close();w.focus();setTimeout(()=>w.print(),300)}},150)};setTimeout(()=>{try{frame.contentWindow.focus();frame.contentWindow.print()}catch(e){}},700)};
function pdfEscape(s){return String(s??'').replace(/\\/g,'\\\\').replace(/[()]/g,'\\$&').replace(/[^\x20-\x7E]/g,'?')}
function pdfBlob(b){const lines=['Sri Krishna Medicals','Kaveri Road, Pennagaram, Dharmapuri District, Tamil Nadu','Phone: 8300363317','Drug Licence No: TN/DPI/01386/20,21','FSSAI Licence No: 22422039000512','','Invoice: '+b.invoiceNumber,'Date: '+b.billDate,'Customer: '+b.customerName,'Mobile: '+(b.mobile||'-'),'Prescribed By: '+(b.doctor||'-'),'','MEDICINE / BATCH / QTY / AMOUNT',...b.items.map(i=>i.name+' / '+i.batchNumber+' / '+i.qty+' / '+money(i.qty*i.price)),'','Subtotal: '+money(b.subtotal),'Discount: '+money(b.discount),'GST: '+money(b.gst),'Grand Total: '+money(b.grandTotal),'Payment: '+b.paymentMode];const text=['BT','/F1 10 Tf','50 800 Td',...lines.flatMap((l,i)=>[i?'0 -16 Td':'', '('+pdfEscape(l)+') Tj']).filter(Boolean),'ET'].join('\n');const objs=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>','<< /Length '+text.length+' >>\nstream\n'+text+'\nendstream'];let pdf='%PDF-1.4\n',offset=[0];objs.forEach((o,i)=>{offset.push(pdf.length);pdf+=(i+1)+' 0 obj\n'+o+'\nendobj\n'});const x=pdf.length;pdf+='xref\n0 '+(objs.length+1)+'\n0000000000 65535 f \n'+offset.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size '+(objs.length+1)+' /Root 1 0 R >>\nstartxref\n'+x+'\n%%EOF';return new Blob([pdf],{type:'application/pdf'})}
window.saveBillPdf=id=>{const b=findBill(id);if(!b)return;const blob=pdfBlob(b),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=b.invoiceNumber+'.pdf';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};
window.shareBill=async id=>{const b=findBill(id);if(!b)return;const text='Sri Krishna Medicals, Pennagaram\nInvoice: '+b.invoiceNumber+'\nCustomer: '+b.customerName+'\nTotal: '+money(b.grandTotal)+'\nPayment: '+b.paymentMode;if(navigator.share){try{const file=new File([pdfBlob(b)],b.invoiceNumber+'.pdf',{type:'application/pdf'});if(navigator.canShare?.({files:[file]}))await navigator.share({title:'Medical Bill '+b.invoiceNumber,text,files:[file]});else await navigator.share({title:'Medical Bill '+b.invoiceNumber,text});return}catch(e){if(e.name==='AbortError')return}}navigator.clipboard?.writeText(text);alert('Bill details copied. You can paste and send to the customer. Use Save PDF to attach the invoice.')};

function billViewHtml(b){const returned=b.returned?'<div class="returnInfo">↩ This bill was returned on '+esc(b.returnedAtText||b.returnedAt||b.billDate||'')+'. Stock has been restored.</div>':'';const shop='<div class="card shopBillHeader" style="padding:14px;margin:10px 0;text-align:center"><b style="font-size:20px">Sri Krishna Medicals</b><br><span>Kaveri Road, Pennagaram, Dharmapuri District, Tamil Nadu</span><br><span>📞 8300363317</span><br><span><b>Drug Licence No:</b> TN/DPI/01386/20,21</span><br><span><b>FSSAI Licence No:</b> 22422039000512</span></div>';return '<h2>📄 Invoice '+esc(b.invoiceNumber)+'</h2>'+returned+'<p class="small">'+esc(b.billDate||'')+' • '+esc(b.paymentMode||'')+'</p>'+shop+'<div class="card" style="padding:14px;margin:10px 0"><b>Customer:</b> '+esc(b.customerName||'Walk-in Customer')+'<br><b>Mobile:</b> '+esc(b.mobile||'-')+'<br><b>Prescribed by:</b> '+esc(b.doctor||'-')+'</div><table class="viewBillTable"><thead><tr><th>Medicine</th><th>Batch</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody>'+((b.items||[]).map(i=>'<tr><td>'+esc(i.name||i.productName||'-')+'</td><td>'+esc(i.batchNumber||'-')+'</td><td>'+Number(i.qty||0)+'</td><td>'+money(i.price)+'</td><td>'+money(Number(i.qty||0)*Number(i.price||0))+'</td></tr>').join(''))+'</tbody></table><div class="modalTotals"><div class="totalLine"><span>Subtotal</span><b>'+money(b.subtotal)+'</b></div><div class="totalLine"><span>Discount</span><b>-'+money(b.discount)+'</b></div><div class="totalLine"><span>GST</span><b>'+money(b.gst)+'</b></div><div class="totalLine grand"><span>Grand Total</span><span>'+money(b.grandTotal)+'</span></div></div><div class="modalActions"><button onclick="printBill(\''+esc(b.id||b.invoiceNumber)+'\')">🖨 Print</button><button class="secondary" onclick="saveBillPdf(\''+esc(b.id||b.invoiceNumber)+'\')">📄 Save PDF</button><button class="ok" onclick="shareBill(\''+esc(b.id||b.invoiceNumber)+'\')">📤 Share</button>'+(!b.returned?'<button class="danger" onclick="returnBill(\''+esc(b.id||b.invoiceNumber)+'\')">↩ Return Bill</button>':'<button class="danger" onclick="deleteBillRecord(\''+esc(b.id||b.invoiceNumber)+'\')">🗑 Delete Record</button>')+'</div>'}
window.viewBill=id=>{const b=findBill(id);if(!b)return alert('Bill not found.');$('billModalContent').innerHTML=billViewHtml(b);const shareBtn=$('billModalContent')?.querySelector('[data-share-bill]');if(shareBtn)shareBtn.onclick=()=>window.shareBill(b.id||b.invoiceNumber);$('billModal').classList.remove('hidden')};window.closeBillView=()=>$('billModal').classList.add('hidden');$('billModal')?.addEventListener('click',e=>{if(e.target===$('billModal'))closeBillView()});
window.renderBillHistory=()=>{const el=$('billHistoryList');if(!el)return;const q=String($('billHistorySearch')?.value||'').trim().toLowerCase();const rows=bills.filter(b=>!q||[b.invoiceNumber,b.customerName,b.mobile].join(' ').toLowerCase().includes(q));el.innerHTML=rows.map(b=>{const id=esc(b.id||b.invoiceNumber);return '<div class="billHistoryRow"><div class="billHistoryTop"><div><b style="font-size:20px">'+esc(b.invoiceNumber)+'</b><div class="small">'+esc(b.billDate||'')+' • '+esc(b.customerName||'Walk-in Customer')+'</div>'+ (b.returned?'<span class="returnedBadge">↩ Returned</span>':'')+'</div><div class="amount">'+money(b.grandTotal)+'</div></div><div class="actions"><button onclick="viewBill(\''+id+'\')">👁 View</button><button class="secondary" onclick="printBill(\''+id+'\')">🖨 Print</button>'+(!b.returned?'<button class="danger" onclick="returnBill(\''+id+'\')">↩ Return</button>':'<button class="danger" onclick="deleteBillRecord(\''+id+'\')">🗑 Delete Record</button>')+'</div></div>'}).join('')||'<div class="small">No bills found.</div>'};
window.returnBill=async id=>{const b=findBill(id);if(!b)return alert('Bill not found.');if(b.returned)return alert('This bill has already been returned.');if(!confirm('Return bill '+b.invoiceNumber+'? This will restore all item quantities back to stock.'))return;try{if(configured){await runTransaction(db,async tx=>{const refs=[];for(const it of b.items||[]){refs.push(doc(db,'batches',it.batchId));refs.push(doc(db,'products',it.productId))}const uniq=[...new Map(refs.map(r=>[r.path,r])).values()];const snaps=await Promise.all(uniq.map(r=>tx.get(r)));const map=new Map(uniq.map((r,i)=>[r.path,snaps[i]]));for(const it of b.items||[]){const br=doc(db,'batches',it.batchId),pr=doc(db,'products',it.productId),bs=map.get(br.path),ps=map.get(pr.path);if(!bs?.exists()||!ps?.exists())throw Error('Original product or batch not found for '+(it.name||it.batchNumber));tx.update(br,{stock:Number(bs.data().stock||0)+Number(it.qty||0),updatedAt:serverTimestamp()});tx.update(pr,{stock:Number(ps.data().stock||0)+Number(it.qty||0),updatedAt:serverTimestamp()});tx.set(doc(collection(db,'stockMovements')),{type:'RETURN',productId:it.productId,batchId:it.batchId,batchNumber:it.batchNumber,qty:Number(it.qty||0),reference:b.invoiceNumber,createdAt:serverTimestamp()})}tx.update(doc(db,'bills',b.id),{returned:true,returnedAt:serverTimestamp(),returnedAtText:new Date().toLocaleString('en-IN'),returnReason:'Bill return - stock restored'})})}else{for(const it of b.items||[]){const batch=batches.find(x=>x.id===it.batchId),prod=products.find(x=>x.id===it.productId);if(!batch||!prod)throw Error('Original product or batch not found for '+(it.name||it.batchNumber));batch.stock=Number(batch.stock||0)+Number(it.qty||0);prod.stock=Number(prod.stock||0)+Number(it.qty||0)}b.returned=true;b.returnedAt=new Date().toISOString();b.returnedAtText=new Date().toLocaleString('en-IN');b.returnReason='Bill return - stock restored';set('batches',batches);set('products',products);set('bills',bills);const sm=get('stockMovements',[]);for(const it of b.items||[])sm.push({id:'RT'+Date.now()+Math.random(),type:'RETURN',productId:it.productId,batchId:it.batchId,batchNumber:it.batchNumber,qty:Number(it.qty||0),reference:b.invoiceNumber,createdAt:new Date().toISOString()});set('stockMovements',sm)}alert('Bill returned successfully. Stock has been restored.');closeBillView();renderAll()}catch(e){alert('Return failed: '+e.message)}};


window.deleteBillRecord=async id=>{
 const b=findBill(id);
 if(!b)return alert('Bill not found.');
 if(!b.returned)return alert('For stock safety, first use Return Bill. After stock is restored, you can permanently delete the returned bill record.');
 if(!confirm('Permanently delete returned bill record '+b.invoiceNumber+'? This cannot be undone.'))return;
 try{
   if(configured){
     await deleteDoc(doc(db,'bills',b.id));
   }else{
     bills=bills.filter(x=>(x.id||x.invoiceNumber)!==id);
     set('bills',bills);
   }
   alert('Returned bill record deleted permanently.');
   closeBillView();
   renderAll();
 }catch(e){alert('Could not delete bill record: '+e.message)}
};

function billRow(b,compact=false){const id=esc(b.id||b.invoiceNumber),returned=b.returned?'<span class="returnedBadge">↩ Returned</span>':'';return '<div class="itemrow"><b>'+esc(b.invoiceNumber)+'</b> • '+esc(b.customerName||'Walk-in')+' <span class="right">'+money(b.grandTotal)+'</span><div class="small">'+esc(b.billDate||'')+' • '+esc(b.paymentMode||'')+'</div>'+returned+'<div class="actions"><button onclick="viewBill(\''+id+'\')">👁 View</button><button onclick="printBill(\''+id+'\')">🖨 Print</button><button class="secondary" onclick="saveBillPdf(\''+id+'\')">📄 Save PDF</button>'+(!b.returned?'<button class="danger" onclick="returnBill(\''+id+'\')">↩ Return</button>':'')+'<button class="ok" onclick="shareBill(\''+id+'\')">📤 Share</button></div></div>'}
window.showBillActions=b=>{setTimeout(()=>{alert('Bill saved successfully. You can now Print, Save PDF or Share it from Recent Bills.')},100)};
window.saveSupplier=async()=>{const name=$('sName').value.trim(),mobile=$('sMobile').value.trim(),address=$('sAddress').value.trim(),gst=$('sGst').value.trim();if(!name)return alert('Enter supplier/company name.');try{if(configured){const id=String(name).toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'')||uid();await setDoc(doc(db,'suppliers',id),{name,mobile,address,gst,updatedAt:serverTimestamp(),createdAt:serverTimestamp()},{merge:true})}else{const i=suppliers.findIndex(x=>x.name.toLowerCase()===name.toLowerCase());const local={id:'S'+Date.now(),name,mobile,address,gst};if(i>=0)suppliers[i]=local;else suppliers.unshift(local);set('suppliers',suppliers)}alert('Supplier saved.');['sName','sMobile','sAddress','sGst'].forEach(id=>$(id).value='');renderAll()}catch(e){alert('Could not save supplier: '+e.message)}};function renderSuppliers(){const el=$('supplierList');if(!el)return;el.innerHTML=suppliers.map(x=>'<div class="itemrow"><b>'+esc(x.name)+'</b><br><span class="small">'+esc(x.mobile||'')+(x.address?' • '+esc(x.address):'')+(x.gst?' • GST: '+esc(x.gst):'')+'</span></div>').join('')||'<div class="small">No suppliers saved yet.</div>'}
const backupCollections=['products','batches','bills','purchases','suppliers','customers','reminders','orders','stockMovements'];
async function backupData(){
 const out={app:'SKMedKART Admin Portal',version:'5.6',createdAt:new Date().toISOString(),mode:configured?'firebase':'demo',collections:{}};
 if(configured){for(const name of backupCollections){const snap=await getDocs(collection(db,name));out.collections[name]=snap.docs.map(d=>({id:d.id,...d.data()}));}}
 else {const map={products,currentOrders,purchases,batches,bills,customers,reminders,suppliers,stockMovements:get('stockMovements',[])};for(const name of backupCollections){const key=name==='orders'?'currentOrders':name;out.collections[name]=map[key]||[];}}
 return out;
}
window.downloadBackup=async()=>{try{const status=$('restoreStatus');if(status)status.textContent='Preparing backup...';const data=await backupData();const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='SKMedKART_BACKUP_'+today()+'_'+Date.now()+'.json';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500);if(status)status.textContent='Backup downloaded successfully.';}catch(e){alert('Backup failed: '+e.message)}};
async function restoreData(data){
 if(!data?.collections||typeof data.collections!=='object')throw Error('Invalid SKMedKART backup file.');
 if(configured){
  for(const name of backupCollections){const rows=Array.isArray(data.collections[name])?data.collections[name]:[];for(let i=0;i<rows.length;i+=400){const wb=writeBatch(db);rows.slice(i,i+400).forEach((row,n)=>{const copy={...row};const id=String(copy.id||uid());delete copy.id;wb.set(doc(db,name,id),copy,{merge:true});});await wb.commit();}}
 }else{
  for(const name of backupCollections){const rows=Array.isArray(data.collections[name])?data.collections[name]:[];if(name==='orders')set('orders',rows);else set(name,rows);}
 }
}
$('restoreFile')?.addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;const status=$('restoreStatus');try{if(!confirm('Restore this backup? Existing matching records will be overwritten or updated.')){e.target.value='';return}if(status)status.textContent='Restoring backup...';const data=JSON.parse(await file.text());await restoreData(data);if(status)status.textContent='Restore completed successfully.';if(!configured){liveStarted=false;await loadAll()}else alert('Restore completed. Live data will refresh automatically.');}catch(err){if(status)status.textContent='Restore failed.';alert('Restore failed: '+err.message)}finally{e.target.value=''}});

window.calculatePurchaseGst=()=>{
  const base=Math.max(0,Number($('puCost')?.value)||0);
  const rate=Math.max(0,Number($('puGst')?.value)||0);
  const total=base+(base*rate/100);
  if($('puCostWithGst'))$('puCostWithGst').value=total.toFixed(2);
  return {base,rate,total};
};
['puCost','puGst'].forEach(id=>$(id)?.addEventListener('input',window.calculatePurchaseGst));
window.savePurchase=async()=>{
  const typedName=$('puProductSearch').value.trim(), selectedId=$('puProduct').value;
  let product=products.find(p=>p.id===selectedId)||findMedicineBySearch(typedName);
  const qty=Math.max(1,Number($('puQty').value)||0),batchNumber=$('puBatch').value.trim(),expiryDate=$('puExpiry').value,supplier=$('puSupplier').value.trim(),invoice=$('puInvoice').value.trim();
  const gst=window.calculatePurchaseGst();
  const category=$('puCategory')?.value||product?.cat||'Human Medicines';
  const schedule=['H','H1'].includes(String($('puSchedule')?.value||'').toUpperCase())?String($('puSchedule').value).toUpperCase():'';
  if(!typedName||!batchNumber||!expiryDate||!qty)return alert('Complete Medicine Name, Batch No., Expiry Date and Purchase Qty.');
  const productId=product?.id||('product_'+uid());
  const purchase={productId,productName:product?.name||typedName,category,cat:category,schedule,qty,batchNumber,expiryDate,supplier,invoice,purchaseDate:$('puDate').value||today(),purchasePrice:gst.base,purchaseGstRate:gst.rate,purchasePriceWithGst:gst.total,mrp:Number($('puMrp').value)||0,sellingPrice:Number($('puSell').value)||Number(product?.price||0)};
  try{
   if(configured){
    const bid=productId+'__'+batchNumber,br=doc(db,'batches',bid),pr=doc(db,'products',productId);
    await runTransaction(db,async tx=>{const [bs,ps]=await Promise.all([tx.get(br),tx.get(pr)]);const existingProduct=ps.exists()?ps.data():{};const old=bs.exists()?bs.data():{};
     tx.set(br,{...old,id:bid,productId,productName:purchase.productName,category:purchase.category,cat:purchase.category,schedule:purchase.schedule,batchNumber,expiryDate,stock:Number(old.stock||0)+qty,purchasePrice:purchase.purchasePrice,purchaseGstRate:purchase.purchaseGstRate,purchasePriceWithGst:purchase.purchasePriceWithGst,mrp:purchase.mrp,sellingPrice:purchase.sellingPrice,updatedAt:serverTimestamp(),createdAt:old.createdAt||serverTimestamp()},{merge:true});
     tx.set(pr,{...existingProduct,id:productId,name:purchase.productName,cat:purchase.category,category:purchase.category,schedule:purchase.schedule,price:purchase.sellingPrice||Number(existingProduct.price||0),stock:Number(existingProduct.stock||0)+qty,lowStockLevel:Number(existingProduct.lowStockLevel??10),purchasePrice:purchase.purchasePrice,purchaseGstRate:purchase.purchaseGstRate,purchasePriceWithGst:purchase.purchasePriceWithGst,mrp:purchase.mrp,gst:purchase.purchaseGstRate,active:true,updatedAt:serverTimestamp(),createdAt:existingProduct.createdAt||serverTimestamp()},{merge:true});
     tx.set(doc(collection(db,'purchases')),{...purchase,createdAt:serverTimestamp()});
     tx.set(doc(collection(db,'stockMovements')),{type:'PURCHASE',productId,batchId:bid,batchNumber,qty,reference:invoice||'PURCHASE',purchasePriceWithGst:purchase.purchasePriceWithGst,createdAt:serverTimestamp()});
    });
   }else{
    if(!product){product={id:productId,name:typedName,cat:purchase.category,category:purchase.category,schedule:purchase.schedule,price:purchase.sellingPrice,stock:0,lowStockLevel:10,active:true};products.push(product)}else{product.cat=purchase.category;product.category=purchase.category;if(purchase.schedule)product.schedule=purchase.schedule;}
    let b=batches.find(x=>x.productId===productId&&x.batchNumber===batchNumber);if(b){b.stock=Number(b.stock||0)+qty;b.expiryDate=expiryDate;b.category=purchase.category;b.cat=purchase.category;b.schedule=purchase.schedule;b.sellingPrice=purchase.sellingPrice;b.mrp=purchase.mrp;b.purchasePrice=purchase.purchasePrice;b.purchaseGstRate=purchase.purchaseGstRate;b.purchasePriceWithGst=purchase.purchasePriceWithGst}else{b={id:productId+'__'+batchNumber,...purchase,stock:qty};batches.push(b)}
    product.stock=Number(product.stock||0)+qty;if(purchase.sellingPrice)product.price=purchase.sellingPrice;Object.assign(product,{purchasePrice:purchase.purchasePrice,purchaseGstRate:purchase.purchaseGstRate,purchasePriceWithGst:purchase.purchasePriceWithGst,mrp:purchase.mrp,gst:purchase.purchaseGstRate});purchases.unshift({...purchase,id:'PU'+Date.now()});
    const sm=get('stockMovements',[]);sm.push({id:'SM'+Date.now(),type:'PURCHASE',productId,batchId:productId+'__'+batchNumber,batchNumber,qty,reference:invoice||'PURCHASE',purchasePriceWithGst:purchase.purchasePriceWithGst,createdAt:new Date().toISOString()});set('stockMovements',sm);set('batches',batches);set('products',products);set('purchases',purchases)
   }
   alert('Purchase saved. Stock increased and Purchase Price + GST calculated automatically.');['puProductSearch','puProduct','puBatch','puExpiry','puQty','puCost','puGst','puCostWithGst','puMrp','puSell'].forEach(id=>$(id).value='');if($('puCategory'))$('puCategory').value='Human Medicines';if($('puSchedule'))$('puSchedule').value='';renderAll()
  }catch(e){alert('Could not save purchase: '+e.message)}
};

window.renderPurchases=()=>{
 const input=$('purchaseSearch'),box=$('purchases');
 if(!input||!box)return;
 const q=String(input.value||'').trim().toLowerCase();
 if(!q){box.innerHTML=purchases.slice(0,100).map(p=>purchaseRow(p)).join('')||'<div class="small">No purchases found.</div>';return}
 const purchaseRows=purchases.filter(p=>{
   const prod=products.find(x=>x.id===p.productId);
   const text=[p.productName,p.medicine,p.name,p.supplier,p.supplierName,p.invoice,p.invoiceNo,p.batchNumber,p.batch,p.expiryDate,prod?.name,prod?.barcode].map(v=>String(v??'')).join(' ').toLowerCase();
   return text.includes(q);
 }).slice(0,100);
 if(purchaseRows.length){box.innerHTML=purchaseRows.map(p=>purchaseRow(p)).join('');return}
 const productRows=products.filter(p=>{
   const text=[p.name,p.barcode,p.cat,p.category].map(v=>String(v??'')).join(' ').toLowerCase();
   return text.includes(q);
 }).slice(0,30);
 if(productRows.length){
   const productIds=new Set(productRows.map(p=>p.id));
   const linked=purchases.filter(p=>productIds.has(p.productId));
   if(linked.length){box.innerHTML=linked.slice(0,100).map(p=>purchaseRow(p)).join('');return}
   box.innerHTML=productRows.map(p=>'<div class="itemrow"><b>'+esc(p.name||'-')+'</b><br><span class="small">Current stock: '+Number(p.stock||0)+' • No purchase record found for this medicine.</span></div>').join('');
   return;
 }
 box.innerHTML='<div class="small">No purchases or products found for “'+esc(input.value)+'”.</div>';
};

function purchaseRow(p){return '<div class="itemrow"><b>'+esc(p.productName||p.medicine||p.name||'-')+'</b> • Qty '+Number(p.qty||0)+'<br><span class="small">'+esc(p.supplier||p.supplierName||'-')+' • Batch '+esc(p.batchNumber||p.batch||'-')+' • Exp '+esc(p.expiryDate||'-')+' • Purchase ₹'+Number(p.purchasePrice||0).toFixed(2)+' + GST '+Number(p.purchaseGstRate||0).toFixed(2)+'% = ₹'+Number(p.purchasePriceWithGst??(Number(p.purchasePrice||0)*(1+Number(p.purchaseGstRate||0)/100))).toFixed(2)+'</span></div>'}
function renderBatches(){$('batchList').innerHTML=batches.slice().sort((a,b)=>t(a.expiryDate)-t(b.expiryDate)).map(b=>{const st=expiryStatus(b);return '<div class=\"itemrow\"><b>'+esc(b.productName||b.productId)+'</b><span class=\"pill '+(st==='OK'?'':'bad')+'\">'+st+'</span><br><span class=\"small\">Batch '+esc(b.batchNumber)+' • Exp '+esc(b.expiryDate)+' • Stock '+Number(b.stock||0)+' • MRP '+money(b.mrp)+' • Sell '+money(b.sellingPrice)+'</span><br><button class=\"danger\" style=\"margin-top:8px;width:auto\" onclick=\"deleteBatch(\''+esc(b.id)+'\')\">🗑️ Delete This Batch</button></div>'}).join('')||'<div class=\"small\">No batches yet. Add stock through Purchase or Opening Stock.</div>'}

window.deleteBatch=async (id)=>{const b=batches.find(x=>x.id===id);if(!b)return alert('Batch not found.');if(!confirm('Delete batch '+(b.batchNumber||'')+' for '+(b.productName||'this medicine')+'? This cannot be undone. Current stock '+Number(b.stock||0)+' will be removed from inventory.'))return;try{if(configured){await runTransaction(db,async tx=>{const br=doc(db,'batches',id),pr=doc(db,'products',b.productId),bs=await tx.get(br),ps=await tx.get(pr);if(!bs.exists())throw Error('Batch not found.');const live=bs.data();if(ps.exists()){const next=Math.max(0,Number(ps.data().stock||0)-Number(live.stock||0));tx.update(pr,{stock:next,updatedAt:serverTimestamp()});}tx.delete(br);tx.set(doc(collection(db,'stockMovements')),{type:'BATCH_DELETE',productId:live.productId||b.productId,batchId:id,batchNumber:live.batchNumber||b.batchNumber,qty:-Number(live.stock||0),reference:'ADMIN_BATCH_DELETE',note:'Mistaken stock/batch deleted by admin',createdAt:serverTimestamp()});});}else{const qty=Number(b.stock||0),prod=products.find(x=>x.id===b.productId);if(prod)prod.stock=Math.max(0,Number(prod.stock||0)-qty);batches=batches.filter(x=>x.id!==id);set('batches',batches);set('products',products);const sm=get('stockMovements',[]);sm.push({id:'DEL'+Date.now(),type:'BATCH_DELETE',productId:b.productId,batchId:id,batchNumber:b.batchNumber,qty:-qty,reference:'ADMIN_BATCH_DELETE',note:'Mistaken stock/batch deleted by admin',createdAt:new Date().toISOString()});set('stockMovements',sm);}alert('Batch deleted successfully. Product stock has been recalculated.');renderAll()}catch(e){alert('Could not delete batch: '+e.message)}};
function orderOptions(cur){return ['Order Placed','Prescription Under Pharmacist Review','Confirmed','Payment Pending','Ready','Out for Delivery','Delivered','Billed','Need Clarification','Cancelled'].map(st=>'<option '+(st===cur?'selected':'')+'>'+st+'</option>').join('')};
function orderCustomer(o){return o.customer||{name:o.customerName||o.name||'',phone:o.mobile||o.phone||'',delivery:o.address||''}}
function renderOrders(){
 $('ordersList').innerHTML=currentOrders.map(o=>{
   const c=orderCustomer(o),isCancelled=(o.status==='Cancelled');
   const items=(o.items||[]).map(x=>esc(x.name||x.productName||x.medicine||'-')+' × '+Number(x.qty||x.quantity||1)).join(', ');
   const billBtn=isCancelled?'<div class="small">This order is cancelled and cannot be billed.</div>':'<button class="ok" onclick="billOnlineOrder(\''+esc(o.id)+'\')">🧾 Direct Bill This Order</button>';
   const cancelBtn=isCancelled?'<button class="secondary" disabled>Cancelled</button>':'<button class="cancelOrderBtn" onclick="cancelOrder(\''+esc(o.id)+'\')">✖ Cancel Order</button>';
   return '<div class="order card '+(isCancelled?'cancelledOrder':'')+'"><b>'+esc(o.orderNumber||o.id)+'</b> <span class="pill '+(o.status==='Billed'?'':(isCancelled?'bad':''))+'">'+esc(o.status||'Order Placed')+'</span><h4>'+esc(c.name||'-')+' • '+esc(c.phone||'-')+'</h4><div>'+items+'</div><p><b>Delivery:</b> '+esc(c.delivery||'-')+'<br><b>Payment:</b> '+esc(o.payment||o.paymentMode||'-')+' • '+esc(o.paymentStatus||'Pending')+'</p>'+(o.prescription?.url?'<p><a class="link" href="'+esc(o.prescription.url)+'" target="_blank">View prescription</a></p>':'')+'<div class="actions">'+billBtn+cancelBtn+'</div><select id="st_'+esc(o.id)+'" '+(isCancelled?'disabled':'')+'>'+orderOptions(o.status||'Order Placed')+'</select><textarea id="note_'+esc(o.id)+'" placeholder="Pharmacist / customer note" '+(isCancelled?'disabled':'')+'>'+esc(o.pharmacistNote||'')+'</textarea><button class="secondary" onclick="updateOrder(\''+esc(o.id)+'\')" '+(isCancelled?'disabled':'')+'>Save Status</button></div>'
 }).join('')||'<div class="small">No orders yet.</div>'
}
window.billOnlineOrder=id=>{
 const o=currentOrders.find(x=>x.id===id);if(!o)return alert('Order not found.');if(o.status==='Cancelled')return alert('Cancelled orders cannot be billed.');const c=orderCustomer(o);billCart=[];sourceOrderId=id;
 $('bCustomer').value=c.name||'';$('bMobile').value=c.phone||'';$('bDoctor').value=o.doctor||o.prescribedBy||o.prescription?.doctor||'';$('bNote').value='Online Order: '+(o.orderNumber||id);
 const pay=o.paymentMode||o.payment||'Cash';$('bPayment').value=['Cash','UPI','Card','Credit'].includes(pay)?pay:'Cash';document.querySelectorAll('.payBtn').forEach(b=>b.classList.toggle('active',b.dataset.pay===$('bPayment').value));
 const missing=[];const reservedRows=getOrderReservedItems(o);(o.items||[]).forEach(it=>{const name=it.name||it.productName||it.medicine||'';const qty=Math.max(1,Number(it.qty||it.quantity||1));let p=products.find(x=>x.id===it.productId)||findMedicineBySearch(name);if(!p){missing.push(name+' (medicine not in stock list)');return}const reservedMatch=reservedRows.find(r=>(r.productId===p.id||String(r.name||r.productName||r.medicine||'').toLowerCase()===String(name).toLowerCase())&&Number(r.qty??r.quantity??0)>=qty);let b=reservedMatch?.batchId?batches.find(x=>x.id===reservedMatch.batchId):null;if(!b)b=batches.filter(x=>x.productId===p.id&&Number(x.stock||0)>=qty&&expiryStatus(x)!=='EXPIRED').sort((a,b)=>t(a.expiryDate)-t(b.expiryDate))[0];if(!b){missing.push(name+' (no available batch stock)');return}billCart.push({productId:p.id,name:p.name,batchId:(reservedMatch?.batchId||b.id),batchNumber:(reservedMatch?.batchNumber||b.batchNumber),expiryDate:b.expiryDate,qty,price:Number(b.sellingPrice||p.price||0),discount:0,gst:Number(p.gst||0),fromReservedOrder:!!reservedMatch});});
 document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));document.querySelector('.tab[data-view="billing"]')?.classList.add('active');document.querySelectorAll('.view').forEach(x=>x.classList.add('hidden'));$('billing').classList.remove('hidden');renderBilling();window.scrollTo({top:0,behavior:'smooth'});
 if(missing.length)alert('Billing page opened. Please check these items: '+missing.join('; '));
 else alert('Online order loaded into Billing. Check items and tap Save Bill.');
};
function isTruthyFlag(v){return v===true||v===1||v==='1'||String(v||'').toLowerCase()==='true'||String(v||'').toLowerCase()==='yes';}
function orderHasStockReservation(o){
 return isTruthyFlag(o.stockReserved)||isTruthyFlag(o.stockDeducted)||isTruthyFlag(o.inventoryDeducted)||isTruthyFlag(o.stockReduced)||isTruthyFlag(o.reserved)||!!o.stockReservedAt||!!o.stockDeductedAt||['reserved','deducted','allocated'].includes(String(o.stockStatus||o.stockReservationStatus||'').toLowerCase());
}
function getOrderReservedItems(o){
 const candidates=[o.stockDeductedItems,o.reservedItems,o.stockReservedItems,o.allocatedItems,o.stockAllocation];
 for(const list of candidates)if(Array.isArray(list)&&list.length)return list.map(x=>({...x,qty:Math.max(0,Number(x.qty??x.quantity??0))})).filter(x=>x.qty>0);
 const flagged=(o.items||[]).filter(x=>isTruthyFlag(x.stockReserved)||isTruthyFlag(x.stockDeducted)||isTruthyFlag(x.reserved)||isTruthyFlag(x.inventoryDeducted));
 if(flagged.length)return flagged.map(x=>({...x,qty:Math.max(0,Number(x.qty??x.quantity??0))})).filter(x=>x.qty>0);
 // Some customer-order versions store one reservation flag on the order instead of every item.
 if(orderHasStockReservation(o))return (o.items||[]).map(x=>({...x,qty:Math.max(0,Number(x.qty??x.quantity??0))})).filter(x=>x.qty>0);
 return [];
}
function normalizeRestockRows(rows){
 const out=[];
 for(const raw of rows){
  const qty=Math.max(0,Number(raw.qty??raw.quantity??0)); if(!qty)continue;
  const name=String(raw.name||raw.productName||raw.medicine||'').trim();
  let p=products.find(x=>x.id===raw.productId||x.id===raw.product||x.id===raw.medicineId);
  if(!p&&name)p=findMedicineBySearch(name);
  if(!p)throw Error('Product not found for restock: '+(name||raw.productId||'unknown item'));
  const wantedBatchId=raw.batchId||raw.allocatedBatchId||raw.stockBatchId||'';
  const wantedBatchNo=String(raw.batchNumber||raw.batch||raw.allocatedBatchNumber||'').trim();
  let b=batches.find(x=>x.id===wantedBatchId&&x.productId===p.id);
  if(!b&&wantedBatchNo)b=batches.find(x=>x.productId===p.id&&String(x.batchNumber||'')===wantedBatchNo);
  out.push({productId:p.id,productName:p.name||name,batchId:b?.id||'',batchNumber:b?.batchNumber||wantedBatchNo,qty});
 }
 return out;
}
async function reserveOrderStock(id,o,status,note){
 if(o.stockRestored)return false;
 if(orderHasStockReservation(o))return false;
 const rows=normalizeRestockRows((o.items||[]).map(x=>({...x,qty:Math.max(0,Number(x.qty??x.quantity??1))})));
 if(!rows.length)throw Error('No medicine items available to reserve for this order.');
 const allocated=[];
 if(configured){
  await runTransaction(db,async tx=>{
   const or=doc(db,'orders',id),os=await tx.get(or);if(!os.exists())throw Error('Order not found.');const live={id,...os.data()};
   if(orderHasStockReservation(live))return;
   const productTotals=new Map(); const batchTotals=new Map();
   for(const row of rows){
    const pr=doc(db,'products',row.productId),ps=await tx.get(pr);if(!ps.exists())throw Error('Product not found: '+row.productName);
    if(Number(ps.data().stock||0)<row.qty)throw Error('Insufficient stock: '+row.productName);
    let bid=row.batchId;
    if(!bid){
      const candidates=batches.filter(x=>x.productId===row.productId&&Number(x.stock||0)>=row.qty&&expiryStatus(x)!=='EXPIRED').sort((x,y)=>t(x.expiryDate)-t(y.expiryDate));
      if(candidates[0])bid=candidates[0].id;
    }
    if(!bid)throw Error('No available batch stock: '+row.productName);
    const br=doc(db,'batches',bid),bs=await tx.get(br);if(!bs.exists())throw Error('Batch not found: '+row.productName);
    if(Number(bs.data().stock||0)<row.qty)throw Error('Insufficient batch stock: '+row.productName);
    productTotals.set(row.productId,(productTotals.get(row.productId)||0)+row.qty);
    batchTotals.set(bid,(batchTotals.get(bid)||0)+row.qty);
    allocated.push({...row,batchId:bid,batchNumber:bs.data().batchNumber||row.batchNumber||''});
   }
   for(const [pid,q] of productTotals){const ps=await tx.get(doc(db,'products',pid));tx.update(doc(db,'products',pid),{stock:Number(ps.data().stock||0)-q,updatedAt:serverTimestamp()})}
   for(const [bid,q] of batchTotals){const bs=await tx.get(doc(db,'batches',bid));tx.update(doc(db,'batches',bid),{stock:Number(bs.data().stock||0)-q,updatedAt:serverTimestamp()})}
   for(const row of allocated)tx.set(doc(collection(db,'stockMovements')),{type:'ORDER_RESERVE',productId:row.productId,batchId:row.batchId,batchNumber:row.batchNumber,qty:-row.qty,reference:live.orderNumber||id,orderId:id,createdAt:serverTimestamp()});
   tx.update(or,{status,pharmacistNote:note,stockReserved:true,stockDeducted:true,stockReservedItems:allocated,stockReservedAt:serverTimestamp(),stockRestoreStatus:'Stock reserved for online order',updatedAt:serverTimestamp()});
  });
 }else{
  for(const row of rows){let b=row.batchId?batches.find(x=>x.id===row.batchId):null;if(!b)b=batches.filter(x=>x.productId===row.productId&&Number(x.stock||0)>=row.qty&&expiryStatus(x)!=='EXPIRED').sort((x,y)=>t(x.expiryDate)-t(y.expiryDate))[0];if(!b)throw Error('No available batch stock: '+row.productName);const pr=products.find(x=>x.id===row.productId);if(!pr||Number(pr.stock||0)<row.qty||Number(b.stock||0)<row.qty)throw Error('Insufficient stock: '+row.productName);pr.stock-=row.qty;b.stock-=row.qty;allocated.push({...row,batchId:b.id,batchNumber:b.batchNumber||''});}
  Object.assign(o,{status,pharmacistNote:note,stockReserved:true,stockDeducted:true,stockReservedItems:allocated,stockReservedAt:new Date().toISOString(),stockRestoreStatus:'Stock reserved for online order'});set('products',products);set('batches',batches);set('orders',currentOrders);const sm=get('stockMovements',[]);allocated.forEach(row=>sm.push({id:'SM'+Date.now()+Math.random(),type:'ORDER_RESERVE',productId:row.productId,batchId:row.batchId,batchNumber:row.batchNumber,qty:-row.qty,reference:o.orderNumber||id,orderId:id,createdAt:new Date().toISOString()}));set('stockMovements',sm);
 }
 return true;
}
async function restoreCancelledOrderStock(id,o,updatedNote){
 if(o.stockRestored)return {restored:false,reason:'already-restored'};
 const raw=getOrderReservedItems(o);if(!raw.length)return {restored:false,reason:'not-reserved'};
 const reserved=normalizeRestockRows(raw);if(!reserved.length)return {restored:false,reason:'not-reserved'};
 if(configured){
  await runTransaction(db,async tx=>{
   const or=doc(db,'orders',id),os=await tx.get(or);if(!os.exists())throw Error('Order not found.');const live={id,...os.data()};if(live.stockRestored)throw Error('STOCK_ALREADY_RESTORED');
   const rows=normalizeRestockRows(getOrderReservedItems(live));if(!rows.length){tx.update(or,{status:'Cancelled',pharmacistNote:updatedNote,cancelledAt:serverTimestamp(),updatedAt:serverTimestamp(),stockRestoreStatus:'No reserved stock to restore'});return}
   const productTotals=new Map(),batchTotals=new Map();for(const row of rows){productTotals.set(row.productId,(productTotals.get(row.productId)||0)+row.qty);if(row.batchId)batchTotals.set(row.batchId,(batchTotals.get(row.batchId)||0)+row.qty)}
   for(const [pid,q] of productTotals){const ps=await tx.get(doc(db,'products',pid));if(!ps.exists())throw Error('Product not found for restock: '+pid);tx.update(doc(db,'products',pid),{stock:Number(ps.data().stock||0)+q,updatedAt:serverTimestamp()})}
   for(const [bid,q] of batchTotals){const bs=await tx.get(doc(db,'batches',bid));if(!bs.exists())throw Error('Batch not found for restock: '+bid);tx.update(doc(db,'batches',bid),{stock:Number(bs.data().stock||0)+q,updatedAt:serverTimestamp()})}
   for(const row of rows)tx.set(doc(collection(db,'stockMovements')),{type:'ORDER_CANCEL_RESTOCK',productId:row.productId,batchId:row.batchId||'',batchNumber:row.batchNumber||'',qty:row.qty,reference:live.orderNumber||id,orderId:id,createdAt:serverTimestamp()});
   tx.update(or,{status:'Cancelled',pharmacistNote:updatedNote,cancelledAt:serverTimestamp(),updatedAt:serverTimestamp(),stockRestored:true,stockRestoredAt:serverTimestamp(),stockRestoreStatus:'Stock automatically restored after admin cancellation'});
  });
 }else{
  const productTotals=new Map(),batchTotals=new Map();for(const row of reserved){productTotals.set(row.productId,(productTotals.get(row.productId)||0)+row.qty);if(row.batchId)batchTotals.set(row.batchId,(batchTotals.get(row.batchId)||0)+row.qty)}
  for(const [pid,q] of productTotals){const pr=products.find(x=>x.id===pid);if(!pr)throw Error('Product not found for restock: '+pid);pr.stock=Number(pr.stock||0)+q}
  for(const [bid,q] of batchTotals){const b=batches.find(x=>x.id===bid);if(!b)throw Error('Batch not found for restock: '+bid);b.stock=Number(b.stock||0)+q}
  Object.assign(o,{status:'Cancelled',pharmacistNote:updatedNote,cancelledAt:new Date().toISOString(),stockRestored:true,stockRestoredAt:new Date().toISOString(),stockRestoreStatus:'Stock automatically restored after admin cancellation'});const sm=get('stockMovements',[]);reserved.forEach(row=>sm.push({id:'SM'+Date.now()+Math.random(),type:'ORDER_CANCEL_RESTOCK',productId:row.productId,batchId:row.batchId||'',batchNumber:row.batchNumber||'',qty:row.qty,reference:o.orderNumber||id,orderId:id,createdAt:new Date().toISOString()}));set('stockMovements',sm);set('batches',batches);set('products',products);set('orders',currentOrders);renderAll();
 }
 return {restored:true};
}
window.cancelOrder=async id=>{
  const o=currentOrders.find(x=>x.id===id);
  if(!o)return alert('Order not found.');
  if(o.status==='Billed')return alert('This order has already been billed. Use bill history / return bill instead of cancelling the order.');
  if(o.status==='Cancelled')return alert('Order is already cancelled.');
  if(!confirm('Cancel this customer order? Reserved stock will be automatically restored to inventory.'))return;
  try{
    const note=(o.pharmacistNote||'').trim();
    const updatedNote=(note?note+'\n':'')+'Order cancelled by admin.';
    const result=await restoreCancelledOrderStock(id,o,updatedNote);
    if(result.restored){
      alert('Order cancelled successfully. Stock has been automatically restored.');
    }else if(configured){
      await updateDoc(doc(db,'orders',id),{
        status:'Cancelled',
        pharmacistNote:updatedNote,
        cancelledAt:serverTimestamp(),
        updatedAt:serverTimestamp(),
        stockRestoreStatus:'No stock reservation was found, so no restock was needed'
      });
      alert('Order cancelled successfully. This order had no reserved stock to restore.');
    }else{
      Object.assign(o,{
        status:'Cancelled',
        pharmacistNote:updatedNote,
        cancelledAt:new Date().toISOString(),
        stockRestoreStatus:'No stock reservation was found, so no restock was needed'
      });
      set('orders',currentOrders);
      renderOrders();
      alert('Order cancelled successfully. This order had no reserved stock to restore.');
    }
  }catch(e){
    if(e.message==='STOCK_ALREADY_RESTORED')alert('Order was already restored. Stock was not added twice.');
    else alert('Could not cancel order: '+e.message);
  }
};
window.updateOrder=async id=>{
 const existing=currentOrders.find(x=>x.id===id);if(existing&&existing.status==='Cancelled')return alert('Cancelled order cannot be changed or billed.');const st=$('st_'+id).value,note=$('note_'+id).value.trim();if(st==='Cancelled'){if(note)existing.pharmacistNote=note;return window.cancelOrder(id)}
 try{
  const reserveStatuses=['Confirmed','Ready','Out for Delivery'];
  if(reserveStatuses.includes(st)&&existing&&!orderHasStockReservation(existing)){
    await reserveOrderStock(id,existing,st,note);alert('Order status updated. Stock has been reserved for this online order.');
  }else if(configured)await updateDoc(doc(db,'orders',id),{status:st,pharmacistNote:note,updatedAt:serverTimestamp()});
  else{const o=currentOrders.find(x=>x.id===id);if(o){o.status=st;o.pharmacistNote=note;set('orders',currentOrders)}}
  renderAll();
 }catch(e){alert('Could not update order: '+e.message)}
};
window.saveProduct=async()=>{const name=$('pname').value.trim(),price=Number($('pprice').value)||0,stock=Number($('pstock').value)||0,lowStockLevel=Math.max(0,Number($('pLow').value)||10),openingBatch=$('pBatch').value.trim(),openingExpiry=$('pExpiry').value;if(!name)return alert('Enter product name.');if(stock>0&&(!openingBatch||!openingExpiry))return alert('For opening stock, enter opening batch number and expiry date so billing stock remains batch-wise correct.');const barcode=$('pBarcode')?.value.trim()||'',purchasePrice=Number($('pPurchase')?.value)||0,mrp=Number($('pMrp')?.value)||0,gst=Number($('pGst')?.value)||0,supplier=$('pSupplier')?.value.trim()||'';
const schedule=['H','H1'].includes(String($('pSchedule')?.value||'').toUpperCase())?String($('pSchedule').value).toUpperCase():'';const id=String(name).toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'').slice(0,100)||'product_'+Date.now(),p={name,cat:$('pcat').value,price,stock,lowStockLevel,barcode,schedule,purchasePrice,mrp,gst,supplier,icon:$('picon').value.trim()||'💊',rx:$('prx').checked,active:true};try{if(configured){await runTransaction(db,async tx=>{const pr=doc(db,'products',id),ps=await tx.get(pr);if(stock>0){const br=doc(db,'batches',id+'__'+openingBatch),bs=await tx.get(br);tx.set(br,{...(bs.exists()?bs.data():{}),id:id+'__'+openingBatch,productId:id,productName:name,schedule,batchNumber:openingBatch,expiryDate:openingExpiry,stock:Number(bs.exists()?bs.data().stock||0:0)+stock,mrp:mrp||price,purchasePrice,sellingPrice:price,gst,updatedAt:serverTimestamp(),createdAt:serverTimestamp()},{merge:true})}tx.set(pr,{...p,stock:Number(ps.exists()?ps.data().stock||0:0)+stock,updatedAt:serverTimestamp(),createdAt:ps.exists()?ps.data().createdAt||serverTimestamp():serverTimestamp()},{merge:true})})}else{p.id=id;const i=products.findIndex(x=>x.id===id);if(i>=0){products[i].stock=Number(products[i].stock||0)+stock;Object.assign(products[i],p)}else products.push(p);if(stock>0){const bid=id+'__'+openingBatch,b=batches.find(x=>x.id===bid);if(b)b.stock+=stock;else batches.push({id:bid,productId:id,productName:name,batchNumber:openingBatch,expiryDate:openingExpiry,stock,mrp:price,sellingPrice:price})}set('products',products);set('batches',batches)}alert('Product saved.');['pname','pBarcode','pprice','pPurchase','pMrp','pGst','pstock','pBatch','pExpiry','pSupplier','picon'].forEach(id=>$(id).value='');$('pLow').value=10;$('prx').checked=false;if($('pSchedule'))$('pSchedule').value='';renderAll()}catch(e){alert(e.message)}};
window.deleteProduct=async id=>{const p=products.find(x=>x.id===id);if(!p)return alert('Product not found.');const related=batches.filter(b=>b.productId===id);if(!confirm('Delete '+(p.name||'this product')+' and its '+related.length+' batch(es)? This is only for a mistaken product upload and cannot be undone.'))return;try{if(configured){const wb=writeBatch(db);related.forEach(b=>wb.delete(doc(db,'batches',b.id)));wb.delete(doc(db,'products',id));await wb.commit();await addDoc(collection(db,'stockMovements'),{type:'PRODUCT_DELETE',productId:id,qty:-Number(p.stock||0),reference:'ADMIN_PRODUCT_DELETE',note:'Mistaken product upload deleted by admin',createdAt:serverTimestamp()});}else{products=products.filter(x=>x.id!==id);batches=batches.filter(b=>b.productId!==id);set('products',products);set('batches',batches);const sm=get('stockMovements',[]);sm.push({id:'PDEL'+Date.now(),type:'PRODUCT_DELETE',productId:id,qty:-Number(p.stock||0),reference:'ADMIN_PRODUCT_DELETE',note:'Mistaken product upload deleted by admin',createdAt:new Date().toISOString()});set('stockMovements',sm);}alert('Product and its related batches deleted successfully.');renderAll()}catch(e){alert('Could not delete product: '+e.message)}};
window.setStockFilter=(filter)=>{const box=$('stockSummary');if(!box)return;box.dataset.filter=['all','out','expiry'].includes(filter)?filter:'all';renderStock();};
window.filterStockSearch=(value)=>{const box=$('stockSummary');if(!box)return;box.dataset.search=String(value||'');renderStockListOnly();};
function getFilteredStock(){const box=$('stockSummary');if(!box)return products;const filter=box.dataset.filter||'all',search=String(box.dataset.search||'').trim().toLowerCase();const expiredProducts=products.filter(p=>batches.some(b=>b.productId===p.id&&expiryStatus(b)==='EXPIRED'));const matches=p=>{if(!search)return true;const pt=[p.name,p.barcode,p.cat].join(' ').toLowerCase();const bt=batches.filter(b=>b.productId===p.id).map(b=>[b.batchNumber,b.expiryDate].join(' ')).join(' ').toLowerCase();return (pt+' '+bt).includes(search)};let shown=products.filter(matches);if(filter==='out')shown=shown.filter(p=>Number(p.stock||0)<=0);if(filter==='expiry')shown=shown.filter(p=>expiredProducts.some(x=>x.id===p.id));return shown;}
function renderStockListOnly(){
 const shown=getFilteredStock(),list=$('stockList');
 if(!list)return;
 list.innerHTML=shown.map(p=>{
   const st=Number(p.stock||0)<=0?'Out of Stock':Number(p.stock||0)<=Number(p.lowStockLevel??10)?'Low Stock':'Available';
   const exp=batches.filter(b=>b.productId===p.id&&expiryStatus(b)==='EXPIRED');
   const expText=exp.length?' • '+exp.length+' expired batch(es)':'';
   return '<div class="itemrow"><b>'+esc(p.name)+'</b> • Current stock: '+Number(p.stock||0)+'<span class="pill '+(st==='Available'?'':'bad')+'">'+st+'</span><br><span class="small">Alert level: '+Number(p.lowStockLevel??10)+expText+'</span><br><button type="button" class="danger" style="margin-top:8px;width:auto" data-delete-product="'+esc(p.id)+'" onclick="window.deleteProduct(this.getAttribute(&#39;data-delete-product&#39;))">🗑️ Delete Product</button></div>';
 }).join('')||'<div class="small">No matching stock found.</div>';
 // Direct button handler above is used for reliable standalone/PWA clicks.
 const c=$('stockShowing');if(c)c.textContent='Showing '+shown.length+' of '+products.length+' products';
}
function renderStock(){
 const box=$('stockSummary');
 if(!box)return;
 const filter=box.dataset.filter||'all';
 const search=String(box.dataset.search||'').trim().toLowerCase();
 const zero=products.filter(p=>Number(p.stock||0)<=0);
 const low=products.filter(p=>Number(p.stock||0)>0&&Number(p.stock||0)<=Number(p.lowStockLevel??10));
 const expiryProducts=products.filter(p=>batches.some(b=>b.productId===p.id&&['EXPIRED','NEAR EXPIRY'].includes(expiryStatus(b))));
 box.innerHTML='<div class="grid">'+
   '<button class="'+(filter==='out'?'ok':'secondary')+'" type="button" onclick="setStockFilter(\'out\')">🔴 Out of stock: '+zero.length+'</button>'+ 
   '<button class="'+(filter==='expiry'?'ok':'secondary')+'" type="button" onclick="setStockFilter(\'expiry\')">📅 Expiry stock: '+expiryProducts.length+'</button>'+ 
   '</div>'+ 
   '<div style="display:flex;gap:8px;margin-top:10px"><input id="stockSearch" value="'+esc(box.dataset.search||'')+'" oninput="filterStockSearch(this.value)" placeholder="🔍 Search medicine / barcode / batch" style="margin:0;flex:1"><button class="secondary" type="button" style="width:auto;white-space:nowrap" onclick="setStockFilter(\'all\');$(\'stockSummary\').dataset.search=\'\';renderStock()">↩ All</button></div>'+ 
   '<div class="small" style="margin-top:8px" id="stockShowing">Showing 0 of '+products.length+' products</div>';
 renderStockListOnly();
}
function renderReports(){const sales=bills.filter(b=>!b.returned).reduce((s,b)=>s+Number(b.grandTotal||0),0),purchaseCost=purchases.reduce((s,p)=>s+Number(p.qty||0)*Number(p.purchasePrice||0),0),gross=sales-purchaseCost;$('reportCards').innerHTML='<div class="stat">Total Sales<br>'+money(sales)+'</div><div class="stat">Purchase Value<br>'+money(purchaseCost)+'</div><div class="stat">Gross Margin<br>'+money(gross)+'</div><div class="stat">Bills<br>'+bills.length+'</div>';$('reportRows').innerHTML=bills.slice(0,100).map(b=>'<tr><td>'+esc(b.invoiceNumber)+'</td><td>'+esc(b.customerName)+'</td><td>'+esc(b.billDate||'')+'</td><td>'+money(b.grandTotal)+'</td><td>'+esc(b.paymentMode)+'</td><td><button onclick="printBill(\''+esc(b.id||b.invoiceNumber)+'\')">Print</button> <button onclick="saveBillPdf(\''+esc(b.id||b.invoiceNumber)+'\')">PDF</button> <button onclick="shareBill(\''+esc(b.id||b.invoiceNumber)+'\')">Share</button></td></tr>').join('')}
function scheduleValue(p){return String(p?.schedule||p?.scheduleClass||'').toUpperCase().replace('SCHEDULE ','');}
function scheduleProductId(item){return item?.productId||item?.productID||'';}
function scheduleItemMatches(item,p){const pid=scheduleProductId(item);if(pid&&pid===p.id)return true;const a=String(item?.productName||item?.name||item?.medicine||'').trim().toLowerCase(),b=String(p?.name||'').trim().toLowerCase();return !!a&&a===b;}
window.setScheduleFilter=filter=>{scheduleFilter=['H','H1',''].includes(filter)?filter:'H';renderScheduleList()};
window.setMedicineSchedule=async(id,value)=>{const schedule=['','H','H1'].includes(String(value||'').toUpperCase())?String(value||'').toUpperCase():'';const p=products.find(x=>x.id===id);if(!p)return;try{if(configured)await updateDoc(doc(db,'products',id),{schedule,updatedAt:serverTimestamp()});else{p.schedule=schedule;set('products',products)}p.schedule=schedule;renderScheduleList()}catch(e){alert('Could not update schedule: '+e.message)}};
function scheduleStats(p){
 const pur=purchases.filter(x=>scheduleItemMatches(x,p));
 const sales=[];for(const b of bills){if(b.returned)continue;for(const it of (b.items||[]))if(scheduleItemMatches(it,p))sales.push({bill:b,item:it})}
 const purchaseQty=pur.reduce((n,x)=>n+Number(x.qty||0),0);
 const purchaseValue=pur.reduce((n,x)=>n+Number(x.qty||0)*Number(x.purchasePriceWithGst??x.purchasePrice??0),0);
 const salesQty=sales.reduce((n,x)=>n+Number(x.item.qty||x.item.quantity||0),0);
 const salesValue=sales.reduce((n,x)=>n+Number(x.item.qty||x.item.quantity||0)*Number(x.item.price||0),0);
 return {purchaseQty,purchaseValue,salesQty,salesValue,pur,sales};
}
function renderScheduleList(){
 const list=$('scheduleList'),summary=$('scheduleSummary');if(!list)return;
 const q=String($('scheduleSearch')?.value||'').trim().toLowerCase();
 const shown=products.filter(p=>scheduleValue(p)===scheduleFilter&&(!q||String(p.name||'').toLowerCase().includes(q)));
 document.querySelectorAll('#scheduleHBtn,#scheduleH1Btn,#scheduleNoneBtn').forEach(b=>b.classList.remove('primary'));
 const active=$(scheduleFilter==='H'?'scheduleHBtn':scheduleFilter==='H1'?'scheduleH1Btn':'scheduleNoneBtn');if(active)active.classList.add('primary');
 summary.textContent=scheduleFilter?(shown.length+' medicine(s) in Schedule '+scheduleFilter):(shown.length+' medicine(s) are not classified as H/H1');
 list.innerHTML=shown.map(p=>{const st=scheduleStats(p),sv=scheduleValue(p);return '<div class="itemrow"><div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><b>'+esc(p.name||'-')+'</b><span class="pill">'+(sv?'Schedule '+sv:'Not Classified')+'</span></div><div class="small" style="margin-top:7px">Purchase: '+st.purchaseQty+' qty • '+money(st.purchaseValue)+'<br>Sales: '+st.salesQty+' qty • '+money(st.salesValue)+'<br>Current stock: '+Number(p.stock||0)+'</div><div class="actions"><button type="button" class="secondary" data-schedule-view="'+esc(p.id)+'">📊 View Purchase / Sales</button><select data-schedule-id="'+esc(p.id)+'" style="margin:0;width:auto;min-width:130px"><option value="H" '+(sv==='H'?'selected':'')+'>Schedule H</option><option value="H1" '+(sv==='H1'?'selected':'')+'>Schedule H1</option><option value="" '+(!sv?'selected':'')+'>Unclassified</option></select></div></div>'}).join('')||'<div class="small">No medicines found here. Select another schedule or enter H/H1 during purchase.</div>';
 list.querySelectorAll('[data-schedule-view]').forEach(b=>b.addEventListener('click',()=>window.viewScheduleMedicine(b.getAttribute('data-schedule-view'))));
 list.querySelectorAll('[data-schedule-id]').forEach(s=>s.addEventListener('change',()=>window.setMedicineSchedule(s.getAttribute('data-schedule-id'),s.value)));
}
window.viewScheduleMedicine=id=>{const p=products.find(x=>x.id===id);if(!p)return alert('Medicine not found.');const st=scheduleStats(p);const purchaseRows=st.pur.slice(0,100).map(x=>'<div class="itemrow"><b>Purchase</b> • '+esc(x.purchaseDate||x.createdAt||'-')+'<br><span class="small">Qty '+Number(x.qty||0)+' • Batch '+esc(x.batchNumber||'-')+' • Supplier '+esc(x.supplier||'-')+' • Value '+money(Number(x.qty||0)*Number(x.purchasePriceWithGst??x.purchasePrice??0))+'</span></div>').join('')||'<div class="small">No purchase records.</div>';const salesRows=st.sales.slice(0,100).map(x=>'<div class="itemrow"><b>Sale '+esc(x.bill.invoiceNumber||'-')+'</b> • '+esc(x.bill.billDate||'-')+'<br><span class="small">Customer '+esc(x.bill.customerName||'-')+' • Qty '+Number(x.item.qty||x.item.quantity||0)+' • Value '+money(Number(x.item.qty||x.item.quantity||0)*Number(x.item.price||0))+'</span></div>').join('')||'<div class="small">No sales records.</div>';$('billModalContent').innerHTML='<button class="secondary" style="float:right" onclick="closeBillView()">✕ Close</button><h3>💊 '+esc(p.name)+'</h3><p><span class="pill">Schedule '+esc(scheduleValue(p)||'-')+'</span></p><div class="totalbox"><div class="totalrow"><span>Total Purchase Qty</span><b>'+st.purchaseQty+'</b></div><div class="totalrow"><span>Total Purchase Value</span><b>'+money(st.purchaseValue)+'</b></div><div class="totalrow"><span>Total Sales Qty</span><b>'+st.salesQty+'</b></div><div class="totalrow"><span>Total Sales Value</span><b>'+money(st.salesValue)+'</b></div><div class="totalrow grand"><span>Current Stock</span><span>'+Number(p.stock||0)+'</span></div></div><h4>Purchase History</h4>'+purchaseRows+'<h4>Sales History</h4>'+salesRows;$('billModal').classList.remove('hidden')};
function reminderDateOf(r){return r.nextDate||r.reminderDate||'';}
function reminderStatus(r){const ds=reminderDateOf(r);if(!ds)return 'No date';const due=new Date(ds+'T00:00:00');const now=new Date();now.setHours(0,0,0,0);const diff=Math.round((due-now)/86400000);if(diff<0)return 'Overdue '+Math.abs(diff)+' day(s)';if(diff===0)return 'Due today';if(diff===1)return 'Due tomorrow';return 'Due in '+diff+' days';}
window.saveReminder=async()=>{const customerName=$('rCustomer').value.trim(),mobile=$('rMobile').value.trim(),medicine=$('rMedicine').value.trim(),reminderDate=$('rDate').value,repeatDays=Math.max(1,Number($('rRepeatDays')?.value)||30),mode=$('rMode')?.value||'Monthly Medicine',note=$('rNote')?.value.trim()||'';if(!customerName||!mobile||!medicine||!reminderDate)return alert('Complete customer, mobile, medicine and reminder date.');const r={customerName,mobile,medicine,reminderDate,nextDate:reminderDate,repeatDays,mode,note,status:'Pending'};try{if(configured)await addDoc(collection(db,'reminders'),{...r,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});else{r.id='R'+Date.now();r.createdAt=new Date().toISOString();reminders.push(r);set('reminders',reminders)}['rCustomer','rMobile','rMedicine','rDate','rNote'].forEach(id=>{$(id).value=''});if($('rRepeatDays'))$('rRepeatDays').value=30;alert('Customer reminder saved.');renderAll()}catch(e){alert(e.message)}};
window.completeReminder=async id=>{const r=reminders.find(x=>x.id===id);if(!r)return;const repeat=Math.max(1,Number(r.repeatDays)||30);const base=reminderDateOf(r)||today();const d=new Date(base+'T00:00:00');d.setDate(d.getDate()+repeat);const nextDate=d.toISOString().slice(0,10);try{if(configured)await updateDoc(doc(db,'reminders',id),{nextDate,reminderDate:nextDate,status:'Pending',lastDoneAt:serverTimestamp(),updatedAt:serverTimestamp()});else{Object.assign(r,{nextDate,reminderDate:nextDate,status:'Pending',lastDoneAt:new Date().toISOString()});set('reminders',reminders)}renderAll();alert('Done. Next reminder: '+nextDate)}catch(e){alert(e.message)}};
window.deleteReminder=async id=>{if(!confirm('Delete this customer reminder?'))return;try{if(configured)await deleteDoc(doc(db,'reminders',id));else{reminders=reminders.filter(x=>x.id!==id);set('reminders',reminders)}renderAll()}catch(e){alert(e.message)}};
function renderReminders(){const list=$('reminderList');if(!list)return;const now=new Date();now.setHours(0,0,0,0);const rs=reminders.slice().sort((x,y)=>String(reminderDateOf(x)).localeCompare(String(reminderDateOf(y))));const due=rs.filter(r=>{const ds=reminderDateOf(r);return ds&&new Date(ds+'T00:00:00')<=new Date(now.getTime()+7*86400000)});const count=$('reminderDueCount');if(count)count.textContent=due.length?('Due: '+due.length):'';list.innerHTML=rs.map(r=>{const ds=reminderDateOf(r),phone=String(r.mobile||'').replace(/\D/g,''),wa=phone.length===10?'91'+phone:phone,msg=encodeURIComponent('Hello '+(r.customerName||'')+', this is Sri Krishna Medicals, Pennagaram. Reminder for '+(r.medicine||'medicine')+'.');const diff=ds?Math.round((new Date(ds+'T00:00:00')-now)/86400000):99,cls=diff<0?'overdueReminder':diff<=7?'dueReminder':'';return '<div class="itemrow '+cls+'"><b>'+esc(r.customerName||'Customer')+'</b> • '+esc(r.medicine||'-')+'<br><span class="small">'+esc(ds)+' • '+esc(reminderStatus(r))+' • Every '+Math.max(1,Number(r.repeatDays)||30)+' days • '+esc(r.mode||'Monthly Medicine')+'<br>'+esc(r.mobile||'')+(r.note?'<br>📝 '+esc(r.note):'')+'</span><div class="reminderActions"><button class="ok" onclick="completeReminder(\''+esc(r.id)+'\')">✓ Done / Next</button>'+(wa?'<a class="link" target="_blank" href="https://wa.me/'+esc(wa)+'?text='+msg+'">WhatsApp</a>':'')+'<button class="danger" onclick="deleteReminder(\''+esc(r.id)+'\')">Delete</button></div></div>'}).join('')||'<div class="small">No customer reminders yet.</div>';}

// UI bridge for the matching V5.9 HTML. These handlers keep every visible button connected.
window.showH1Purchases=()=>{
 const rows=purchases.filter(x=>{const p=products.find(pr=>pr.id===scheduleProductId(x));return p&&scheduleValue(p)==='H1';});
 const html=rows.slice(0,200).map(x=>'<div class="itemrow"><b>'+esc(x.productName||x.medicine||x.name||'-')+'</b> <span class="pill">Schedule H1</span><br><span class="small">Qty '+Number(x.qty||0)+' • Batch '+esc(x.batchNumber||x.batch||'-')+' • Date '+esc(x.purchaseDate||x.createdAt||'-')+' • Supplier '+esc(x.supplier||x.supplierName||'-')+' • Value '+money(Number(x.qty||0)*Number(x.purchasePriceWithGst??x.purchasePrice??0))+'</span></div>').join('')||'<div class="small">No H1 purchase records found.</div>';
 $('billModalContent').innerHTML='<h3>💊 H1 Purchases Only</h3><p class="small">Only purchased medicines classified as Schedule H1 are shown.</p>'+html;
 $('billModal').classList.remove('hidden');
};
window.showH1Sales=()=>{
 const h1=products.filter(p=>scheduleValue(p)==='H1');
 const rows=[];for(const b of bills){if(b.returned)continue;for(const it of (b.items||[])){const p=h1.find(pr=>scheduleItemMatches(it,pr));if(p)rows.push({b,it,p});}}
 const html=rows.slice(0,200).map(x=>'<div class="itemrow"><b>'+esc(x.it.name||x.p.name||'-')+'</b> <span class="pill">Schedule H1</span><br><span class="small">Bill '+esc(x.b.invoiceNumber||'-')+' • '+esc(x.b.billDate||'-')+' • Customer '+esc(x.b.customerName||'-')+' • Qty '+Number(x.it.qty||x.it.quantity||0)+' • Value '+money(Number(x.it.qty||x.it.quantity||0)*Number(x.it.price||0))+'</span></div>').join('')||'<div class="small">No H1 billed/sales records found.</div>';
 $('billModalContent').innerHTML='<h3>🧾 H1 Sales / Billed Only</h3><p class="small">Only billed medicines classified as Schedule H1 are shown.</p>'+html;
 $('billModal').classList.remove('hidden');
};
window.show=(id)=>{document.querySelectorAll('.view').forEach(v=>v.classList.add('hidden'));document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t.dataset.view===id));$(id)?.classList.remove('hidden');window.scrollTo({top:0,behavior:'smooth'});if(id==='stock')renderStock();if(id==='purchase')renderPurchases();if(id==='billing')renderBilling();if(id==='history')renderBillHistory();};
window.openBillHistory=()=>window.show('history');
window.openReminderManager=()=>window.show('reminders');
window.openCustomerHistory=()=>{const m=$('bMobile')?.value.trim();const list=customers.filter(c=>!m||String(c.mobile||'')===m);alert(list.length?list.map(c=>c.name+' • '+c.mobile+' • Last bill: '+(c.lastBillNumber||'-')).join('\n'):'No customer history found.');};
window.setPayment=(mode)=>{if($('bPayment'))$('bPayment').value=mode;document.querySelectorAll('.payBtn').forEach(b=>b.classList.toggle('active',b.dataset.pay===mode));};
window.scanBarcode=()=>alert('Barcode scanner is not available in this browser build. Use the medicine search field to find the product.');
window.searchMedicine=()=>{};
window.previewBill=()=>{if(!billCart.length)return alert('Add at least one item first.');const temp={invoiceNumber:'PREVIEW',customerName:$('bCustomer').value||'Walk-in Customer',mobile:$('bMobile').value,doctor:$('bDoctor').value,paymentMode:$('bPayment').value,note:$('bNote').value,items:billCart,...billTotals(),billDate:today()};const w=window.open('','_blank');if(!w)return alert('Please allow popups for Print / PDF.');w.document.write(billHtml(temp));w.document.close();w.focus();setTimeout(()=>w.print(),300)};
window.openBillViewFromButton=id=>window.viewBill(id);
window.addEventListener('DOMContentLoaded',()=>{window.calculatePurchaseGst?.();if(configured)ensureFirebase().catch(e=>{console.error('Firebase startup error:',e);loginMessage('⚠️ Firebase connection could not be initialized. Tap Login to retry.','error')});});
