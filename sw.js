const CACHE='skmedkart-admin-v5.9.62-final';
const ADMIN_URL='./admin.js?v=5.9.62-final';
const ASSETS=['./','./index.html',ADMIN_URL,'./manifest.webmanifest','./invoice-top-logo.png','./invoice-footer-logo.jpg','./pharmacist_signature.jpg'];
async function patchedAdminResponse(){
  const r=await fetch(ADMIN_URL,{cache:'no-store'}); if(!r.ok)return r;
  let s=await r.text();
  const old=` const nums=bills.map(b=>{const m=String(b.invoiceNumber||'').match(/^SKM-(\\d+)$/);return m?Number(m[1])||0:0});\n const pending=getPendingBills();for(const b of pending){const m=String(b.invoiceNumber||'').match(/^SKM-(\\d+)$/);if(m)nums.push(Number(m[1])||0)}\n const invoiceNumber='SKM-'+String(Math.max(0,...nums)+1).padStart(3,'0');`;
  const fresh=` const pending=getPendingBills();\n const usedInvoiceNumbers=new Set([...bills,...pending].map(b=>String(b?.invoiceNumber||'').trim()).filter(Boolean));\n let nextInvoiceNo=Math.max(0,...[...usedInvoiceNumbers].map(v=>{const m=v.match(/^SKM-(\\d+)$/);return m?Number(m[1])||0:0}))+1;\n let invoiceNumber='SKM-'+String(nextInvoiceNo).padStart(3,'0');\n while(usedInvoiceNumbers.has(invoiceNumber)){nextInvoiceNo++;invoiceNumber='SKM-'+String(nextInvoiceNo).padStart(3,'0');}`;
  if(s.includes(old))s=s.replace(old,fresh);
  return new Response(s,{status:r.status,statusText:r.statusText,headers:{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-store'}});
}
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(async c=>{for(const a of ASSETS){try{if(a===ADMIN_URL)c.put(a,await patchedAdminResponse());else{const r=await fetch(a,{cache:'no-store'});if(r.ok)c.put(a,r.clone())}}catch{}}await self.skipWaiting()})));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('skmedkart-admin-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;const url=new URL(e.request.url);if(url.origin===self.location.origin&&url.pathname.endsWith('/admin.js')){e.respondWith(patchedAdminResponse().then(r=>{caches.open(CACHE).then(c=>c.put(ADMIN_URL,r.clone())).catch(()=>{});return r}).catch(()=>caches.match(ADMIN_URL)));return}e.respondWith(fetch(e.request).then(r=>{if(r&&r.ok)caches.open(CACHE).then(c=>c.put(e.request,r.clone())).catch(()=>{});return r}).catch(()=>caches.match(e.request)))});
