const K='skm_v11_';
const SUPABASE_URL='https://uyobhzkcvfnrioppwkrv.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_5zmngPN80O2CPgtNhGNhEQ_elEQpz9E';
const WHATSAPP_NUMBER='918300363317';
let products=[],currentCat='All',deferredPrompt=null,loadingCatalog=false;
const get=(k,d)=>{try{return JSON.parse(localStorage.getItem(K+k)||JSON.stringify(d))}catch{return d}};
const set=(k,v)=>localStorage.setItem(K+k,JSON.stringify(v));
const esc=s=>String(s??'').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));
function showNotice(msg,kind='warning'){const n=document.getElementById('backendNotice');if(!n)return;n.className='card '+kind;n.classList.remove('hidden');n.innerHTML=msg}
async function loadProducts(){
 if(loadingCatalog)return; loadingCatalog=true;
 try{
  const url=SUPABASE_URL+'/rest/v1/public_catalog?select=id,name,category,price,mrp,stock,active&active=eq.true&stock=gt.0&order=name.asc';
  const r=await fetch(url,{headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+SUPABASE_PUBLISHABLE_KEY},cache:'no-store'});
  if(!r.ok)throw Error('Catalogue HTTP '+r.status);
  const rows=await r.json();
  products=Array.isArray(rows)?rows.map(x=>({id:String(x.id),name:String(x.name||''),cat:String(x.category||'Human Medicines'),price:Number(x.price||0),mrp:Number(x.mrp||0),stock:Math.max(0,Number(x.stock||0)),active:x.active!==false})).filter(x=>x.name&&x.stock>0):[];
  set('productsCache',products);set('catalogUpdatedAt',new Date().toISOString());
  showNotice('☁️ <b>Live catalogue</b><br><span class="small">Showing the latest available stock published by Sri Krishna Medicals.</span>','success');
 }catch(e){
  products=get('productsCache',[]).filter(x=>x.active!==false&&Number(x.stock||0)>0);
  if(products.length)showNotice('📦 <b>Offline catalogue copy</b><br><span class="small">Internet sync is unavailable. Showing the last catalogue received from the pharmacy.</span>','warning');
  else showNotice('⚠️ <b>Catalogue unavailable</b><br><span class="small">Please connect to the internet and try again.</span>','warning');
  console.error(e);
 }finally{loadingCatalog=false;renderProducts();renderCart();updateCartBar()}
}
function getProduct(id){return products.find(p=>String(p.id)===String(id))}
window.refreshCatalogue=()=>loadProducts();
window.page=id=>{document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));const el=document.getElementById(id);if(!el)return;el.classList.add('active');if(id==='home'){currentCat='All';renderProducts()}if(id==='catalogue')renderProducts();if(id==='cart')renderCart();if(id==='orders')renderOrders();if(id==='account')renderAccount();window.scrollTo(0,0)};
window.filterCat=c=>{currentCat=c;document.getElementById('catTitle').textContent=c+' Catalogue';page('catalogue')};
window.renderProducts=()=>{
 const q=((document.getElementById('search')?.value||'')+' '+(document.getElementById('catSearch')?.value||'')).toLowerCase().trim();
 const arr=products.filter(p=>(currentCat==='All'||p.cat===currentCat)&&(!q||[p.name,p.cat].join(' ').toLowerCase().includes(q))&&Number(p.stock||0)>0);
 const html=arr.map(p=>`<div class="card product"><div class="pic">💊</div><div class="info"><b>${esc(p.name)}</b><div class="small">${esc(p.cat)}</div><div class="price">${Number(p.price)>0?'₹'+Number(p.price):'Price on confirmation'}</div><div class="small">Available: ${Number(p.stock||0)}</div></div><button onclick="addCart('${esc(p.id)}')">Add</button></div>`).join('')||'<div class="card small">No products available right now.</div>';
 document.getElementById('products').innerHTML=currentCat==='All'?html:'';document.getElementById('catalogueProducts').innerHTML=html;
};
function cart(){return get('cart',[])}
function saveCart(c){set('cart',c);updateCartBar()}
window.addCart=id=>{const p=getProduct(id);if(!p||Number(p.stock||0)<=0)return alert('This product is currently unavailable.');let c=cart(),x=c.find(z=>z.id===p.id);if(x){if(x.qty>=Number(p.stock))return alert('Only '+p.stock+' available.');x.qty++}else c.push({id:p.id,name:p.name,cat:p.cat,price:Number(p.price)||0,qty:1});saveCart(c);renderCart()};
window.renderCart=()=>{let c=cart(),box=document.getElementById('cartitems');box.innerHTML=c.map((x,i)=>`<div class="card row"><div><b>${esc(x.name)}</b><div class="small">${x.price?'₹'+x.price:'Price on confirmation'} × ${x.qty}</div></div><div><button class="secondary" onclick="changeQty(${i},-1)">−</button><b>${x.qty}</b><button class="secondary" onclick="changeQty(${i},1)">+</button><button class="danger" onclick="removeCart(${i})">Remove</button></div></div>`).join('');document.getElementById('emptycart').style.display=c.length?'none':'block';document.getElementById('total').textContent=total(c)};
window.changeQty=(i,d)=>{let c=cart(),p=getProduct(c[i].id);let max=Number(p?.stock||c[i].qty);c[i].qty=Math.min(max,c[i].qty+d);if(c[i].qty<1)c.splice(i,1);saveCart(c);renderCart()};
window.removeCart=i=>{let c=cart();c.splice(i,1);saveCart(c);renderCart()};
const total=c=>c.reduce((s,x)=>s+(Number(x.price)||0)*Number(x.qty||0),0);
function updateCartBar(){let c=cart(),b=document.getElementById('cartbar');if(!b)return;if(!c.length){b.style.display='none';return}b.style.display='block';document.getElementById('cartsum').textContent=c.reduce((s,x)=>s+x.qty,0)+' item(s) • ₹'+total(c)}
window.customerLogin=()=>{let n=document.getElementById('loginName').value.trim(),p=document.getElementById('loginPhone').value.trim();if(!n||!/^[0-9]{10}$/.test(p))return alert('Enter your name and valid 10-digit mobile number.');set('user',{name:n,phone:p});page('home')};
window.goToCheckout=()=>{if(!cart().length)return alert('Your cart is empty.');let u=get('user',null);if(!u){alert('Please Login / Register first.');page('login');return}document.getElementById('name').value=u.name||'';document.getElementById('phone').value=u.phone||'';page('checkout')};
window.placeOrder=async()=>{
 const c=cart(),nameV=document.getElementById('name').value.trim(),phoneV=document.getElementById('phone').value.trim(),addressV=document.getElementById('address').value.trim(),deliveryV=document.getElementById('delivery').value;
 if(!c.length)return alert('Cart is empty.');if(!nameV||!/^[0-9]{10}$/.test(phoneV)||(!addressV&&deliveryV==='Home Delivery'))return alert('Please complete name, valid mobile number and delivery address.');
 const file=document.getElementById('rxfile').files[0];
 const items=c.map(x=>({name:x.name,qty:x.qty,price:x.price}));
 const lines=['*SKMedKART CUSTOMER ORDER*','Sri Krishna Medicals, Pennagaram','',`Customer: ${nameV}`,`Mobile: ${phoneV}`,`Delivery: ${deliveryV}`,`Address: ${addressV||'Store Pickup'}`,'','*Medicines:*',...items.map(x=>'• '+x.name+' × '+x.qty+(x.price?' — ₹'+(x.price*x.qty).toFixed(2):'')),'',`Estimated Total: ₹${total(c).toFixed(2)}`];
 if(file)lines.push('',`Prescription file: ${file.name}`,'Please attach the prescription file in this WhatsApp chat.');
 lines.push('','Please confirm availability, final price and payment instructions.');
 const text=lines.join('\n');
 const order={id:'WA_'+Date.now(),orderNumber:'SKM-WA-'+Date.now().toString().slice(-6),customer:{name:nameV,phone:phoneV,address:addressV,delivery:deliveryV},items,total:total(c),status:'WhatsApp Order',createdAt:new Date().toISOString(),prescriptionFile:file?.name||''};
 const history=get('orders',[]);history.unshift(order);set('orders',history.slice(0,100));set('user',{name:nameV,phone:phoneV});set('cart',[]);updateCartBar();renderCart();
 window.open('https://wa.me/'+WHATSAPP_NUMBER+'?text='+encodeURIComponent(text),'_blank');
 alert(file?'WhatsApp opened. Please attach the prescription file before sending.':'WhatsApp opened with your order. Please send the message to complete the order.');page('orders');
};
window.renderOrders=()=>{const u=get('user',null);const arr=u?get('orders',[]).filter(o=>o.customer?.phone===u.phone):[];document.getElementById('ordersList').innerHTML=arr.map(o=>`<div class="card"><b>${esc(o.orderNumber)}</b><div class="status"><b>WhatsApp Order</b></div><div class="small">${new Date(o.createdAt).toLocaleString('en-IN')}</div><p>${(o.items||[]).map(x=>esc(x.name)+' × '+x.qty).join(', ')}</p><b>Estimated Total: ₹${Number(o.total||0).toFixed(2)}</b><p class="small">Order was sent to Sri Krishna Medicals through WhatsApp. Final availability and price will be confirmed by the pharmacy.</p></div>`).join('')||'<div class="card small">No WhatsApp orders on this phone yet.</div>'};
function renderAccount(){const u=get('user',null);document.getElementById('accountBox').innerHTML=u?`<b>${esc(u.name)}</b><br><span class="small">${esc(u.phone)}</span><br><button class="secondary" onclick="refreshCatalogue()">🔄 Refresh Catalogue</button>`:'<button onclick="page(\'login\')">Login / Register</button>'}
window.logout=()=>{localStorage.removeItem(K+'user');page('home')};
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;const b=document.getElementById('installBtn');if(b)b.classList.remove('hidden')});
window.installApp=()=>{if(deferredPrompt){deferredPrompt.prompt();deferredPrompt.userChoice.then(()=>deferredPrompt=null)}else alert('Use Chrome ⋮ → Install app or Add to Home screen.')};
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js'));
showNotice('☁️ <b>Connecting to pharmacy catalogue…</b><br><span class="small">Billing and stock are not changed by the Customer App.</span>');loadProducts();renderCart();updateCartBar();
setInterval(loadProducts,60000);window.addEventListener('focus',()=>loadProducts());
