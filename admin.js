import {initializeApp} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {getStorage,ref,getDownloadURL} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';
import {getAuth,signInWithEmailAndPassword,onAuthStateChanged,signOut} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {getFirestore,collection,onSnapshot,query,doc,updateDoc,serverTimestamp,addDoc,getDocs} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
const K='skm_v10_',cfg=window.SKMED_FIREBASE_CONFIG||{},admins=window.SKMED_ADMIN_EMAILS||[];
const configured=!!(cfg.projectId&&!String(cfg.projectId).startsWith('PASTE_'));
let db=null,auth=null,storage=null,currentOrders=[],products=[],liveStarted=false;
if(configured){const a=initializeApp(cfg);db=getFirestore(a);auth=getAuth(a);storage=getStorage(a)}
const $=id=>document.getElementById(id);const esc=s=>String(s??'').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));
const get=(k,d)=>{try{return JSON.parse(localStorage.getItem(K+k)||JSON.stringify(d))}catch{return d}};const set=(k,v)=>localStorage.setItem(K+k,JSON.stringify(v));
const t=v=>v?.toDate?v.toDate().getTime():new Date(v||0).getTime();
$('notice').innerHTML=configured?'<b>☁️ Live online mode</b><br><span class="small">Orders and stock sync through Firebase.</span>':'<b>📱 Test mode</b><br><span class="small">Use the customer app and this Admin Portal on the same phone/browser to test. Different phones require Firebase configuration.</span>';
function notify(title,msg){if('Notification'in window&&Notification.permission==='granted')new Notification(title,{body:msg});}
function showPanel(){ $('loginCard').classList.add('hidden');$('panel').classList.remove('hidden');loadAll() }
window.adminLogin=async()=>{const em=$('email').value.trim(),pw=$('password').value;if(!configured){if(em==='admin@skmedkart.local'&&pw==='1234'){showPanel();return}alert('Demo login: admin@skmedkart.local / 1234');return}try{await signInWithEmailAndPassword(auth,em,pw)}catch(e){alert('Login failed: '+e.message)}};
window.adminLogout=()=>configured?signOut(auth):($('panel').classList.add('hidden'),$('loginCard').classList.remove('hidden'));
if(configured)onAuthStateChanged(auth,u=>{if(!u){$('panel').classList.add('hidden');$('loginCard').classList.remove('hidden');return}if(admins.length&&!admins.includes(u.email)){alert('This account is not authorized as admin.');signOut(auth);return}showPanel()});
async function loadAll(){if(!configured){products=get('products',[]);currentOrders=get('orders',[]);render();return}listenLive()}
function listenLive(){if(liveStarted)return;liveStarted=true;let first=true;onSnapshot(collection(db,'orders'),s=>{const prev=currentOrders.length;currentOrders=s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>t(b.createdAt)-t(a.createdAt));if(!first&&currentOrders.length>prev)notify('SKMedKART New Order','A new customer order has arrived.');first=false;render()},e=>{$('orders').innerHTML='<div class="warning">Orders error: '+esc(e.message)+'</div>'});onSnapshot(collection(db,'products'),s=>{products=s.docs.map(d=>({id:d.id,...d.data()}));render()},()=>{})}
function render(){const low=products.filter(p=>Number(p.stock||0)<=Number(p.lowStockLevel||10));$('newCount').textContent=currentOrders.filter(o=>!['Delivered','Rejected'].includes(o.status)).length;$('lowCount').textContent=low.length;$('prodCount').textContent=products.length;let alerts=configured?currentOrders.filter(o=>['Order Placed','Prescription Under Pharmacist Review'].includes(o.status)).map(o=>({type:'Order',message:o.orderNumber+' • '+o.customer?.name})):get('adminAlerts',[]).filter(a=>!a.read);$('alerts').innerHTML=alerts.map(a=>'<div class="card"><b>'+esc(a.type)+'</b><br>'+esc(a.message)+'</div>').join('')||'<div class="small">No unread notifications.</div>';renderOrders();renderStock()}
function opts(cur){return ['Order Placed','Prescription Under Pharmacist Review','Confirmed','Payment Pending','Ready','Out for Delivery','Delivered','Need Clarification'].map(s=>'<option '+(s===cur?'selected':'')+'>'+s+'</option>').join('')}
function getPrescriptionUrl(o){
  return o?.prescription?.url || o?.prescription?.downloadURL || o?.prescription?.dataUrl || o?.prescription?.dataURL || o?.prescriptionUrl || o?.prescriptionURL || o?.rxUrl || o?.rxURL || o?.rx?.url || o?.rx?.downloadURL || o?.prescriptionDataUrl || o?.prescriptionDataURL || '';
}
function getPrescriptionPath(o){
  return o?.prescription?.path || o?.prescription?.storagePath || o?.prescriptionPath || o?.prescriptionStoragePath || o?.rxPath || '';
}
function getPrescriptionName(o){
  return o?.prescription?.name || o?.prescription?.fileName || o?.prescriptionName || o?.rxName || 'Prescription';
}
async function resolvePrescriptionUrl(o){
  const direct=getPrescriptionUrl(o);
  if(direct)return direct;
  const path=getPrescriptionPath(o);
  if(path && storage){
    try{return await getDownloadURL(ref(storage,path));}catch(e){console.warn('Prescription URL lookup failed',e);}
  }
  return '';
}
function prescriptionHtml(url,name){
  if(!url)return '';
  const isImage=/\.(jpg|jpeg|png|webp)(\?|$)/i.test(url)||/^data:image\//i.test(url);
  return `<div class="card" style="margin:10px 0;padding:12px;background:#f8fbfd"><b>📄 Uploaded Prescription</b><br><span class="small">${esc(name)}</span>${isImage?`<div style="margin-top:10px"><img src="${esc(url)}" alt="Uploaded prescription" style="max-width:100%;max-height:420px;border:1px solid #d8e1ea;border-radius:10px"></div>`:''}<div style="margin-top:10px"><a class="link" href="${esc(url)}" target="_blank" rel="noopener" style="display:block;text-align:center;padding:14px;border:1px solid #125a7a;border-radius:10px;text-decoration:none">👁️ VIEW PRESCRIPTION COPY</a></div></div>`;
}
function renderOrders(){
  $('orders').innerHTML=currentOrders.map(o=>{
    const rxName=getPrescriptionName(o), direct=getPrescriptionUrl(o), path=getPrescriptionPath(o);
    const rxBlock=(direct||path||o.needsRx)?`<div id="rx_${esc(o.id)}" class="card" style="margin:10px 0;padding:12px;background:#f8fbfd">${direct?prescriptionHtml(direct,rxName):'<b>📄 Uploaded Prescription</b><br><span class="small">Loading prescription copy...</span>'}</div>`:'';
    return `<div class="order"><b>${esc(o.orderNumber||o.id)}</b> <span class="pill">${esc(o.status)}</span><br><span class="small">${o.createdAt?.toDate?o.createdAt.toDate().toLocaleString():esc(o.createdAt||'')}</span><h4>${esc(o.customer?.name)} • ${esc(o.customer?.phone)}</h4><div>${(o.items||[]).map(x=>esc(x.name)+' × '+x.qty).join(', ')}</div><p><b>Delivery:</b> ${esc(o.customer?.delivery)}<br><b>Address:</b> ${esc(o.customer?.address||'-')}<br><b>Payment:</b> ${esc(o.payment)} • ${esc(o.paymentStatus||'Pending')}</p>${rxBlock}<select id="st_${esc(o.id)}">${opts(o.status)}</select><textarea id="note_${esc(o.id)}" placeholder="Pharmacist note / message to customer">${esc(o.pharmacistNote||'')}</textarea><div class="grid"><button class="ok" onclick="updateOrder('${esc(o.id)}')">Save Status</button><button class="danger" onclick="rejectOrder('${esc(o.id)}')">Reject / Clarify</button></div></div>`;
  }).join('')||'<div class="small">No orders yet.</div>';
  currentOrders.filter(o=>o.needsRx).forEach(async o=>{
    const box=$('rx_'+o.id); if(!box)return;
    const url=await resolvePrescriptionUrl(o), name=getPrescriptionName(o);
    if(url)box.innerHTML=prescriptionHtml(url,name);
    else box.innerHTML='<div class="warning"><b>⚠️ Prescription record was requested, but this order does not contain a viewable prescription URL/path.</b><br><span class="small">This means the prescription file was not saved with this particular order. New orders must be placed again after the customer-side storage fix.</span></div>';
  });
}
window.updateOrder=async id=>{const st=$('st_'+id).value,note=$('note_'+id).value.trim();try{if(configured){await updateDoc(doc(db,'orders',id),{status:st,pharmacistNote:note,updatedAt:serverTimestamp()})}else{let a=get('orders',[]),o=a.find(x=>x.id===id);if(o){o.status=st;o.pharmacistNote=note;o.updatedAt=new Date().toISOString();set('orders',a);currentOrders=a}render()}alert('Order status updated.')}catch(e){alert('Could not update order: '+e.message)}};
window.rejectOrder=id=>{$('st_'+id).value='Need Clarification';window.updateOrder(id)};
window.saveProduct=async()=>{const name=$('pname').value.trim(),price=Number($('pprice').value),stock=Number($('pstock').value);if(!name)return alert('Enter product name.');const p={name,cat:$('pcat').value,price:Number.isFinite(price)?price:0,stock:Number.isFinite(stock)?stock:0,lowStockLevel:10,icon:$('picon').value.trim()||'💊',rx:$('prx').checked,active:true,createdAt:configured?serverTimestamp():new Date().toISOString()};try{if(configured)await addDoc(collection(db,'products'),p);else{const a=get('products',[]);p.id='P'+Date.now();a.push(p);set('products',a);products=a;render()}$('pname').value=$('pprice').value=$('pstock').value=$('picon').value='';$('prx').checked=false;alert('Product added to customer catalogue.')}catch(e){alert('Could not save product: '+e.message)}};
function renderStock(){ $('stockList').innerHTML=products.map(p=>`<div class="card"><div class="row"><div><b>${esc(p.name)}</b><br><span class="small">${esc(p.cat)} • Current stock: ${Number(p.stock||0)}</span></div><span class="${Number(p.stock||0)<=Number(p.lowStockLevel||10)?'warning':'pill'}">${Number(p.stock||0)<=Number(p.lowStockLevel||10)?'Low Stock':'Available'}</span></div><div class="grid"><input id="stock_${esc(p.id)}" type="number" min="0" value="${Number(p.stock||0)}"><button onclick="updateStock('${esc(p.id)}')">Update Stock</button></div></div>`).join('')||'<div class="small">No products added yet.</div>'}
window.updateStock=async id=>{const value=Math.max(0,Number($('stock_'+id).value)||0);try{if(configured)await updateDoc(doc(db,'products',id),{stock:value,updatedAt:serverTimestamp()});else{let a=get('products',[]),p=a.find(x=>x.id===id);if(p)p.stock=value;set('products',a);products=a;render()}alert('Stock updated. Customer catalogue will refresh from the shared data.')}catch(e){alert('Could not update stock: '+e.message)}};
