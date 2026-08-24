import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';

import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

import {
  getFirestore,
  collection,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
  getDocs,
  setDoc
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';


const K = 'skm_v10_';

const cfg = window.SKMED_FIREBASE_CONFIG || {};

const admins = window.SKMED_ADMIN_EMAILS || [];


const configured =
  !!(cfg.projectId && !String(cfg.projectId).startsWith('PASTE_'));


let db = null;
let auth = null;

let currentOrders = [];
let products = [];

let liveStarted = false;


if (configured) {
  const app = initializeApp(cfg);

  db = getFirestore(app);

  auth = getAuth(app);
}


const $ = id => document.getElementById(id);


const esc = s =>
  String(s ?? '').replace(
    /[&<>'"]/g,
    m => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[m])
  );


const get = (k, d) => {
  try {
    return JSON.parse(
      localStorage.getItem(K + k) ||
      JSON.stringify(d)
    );
  } catch {
    return d;
  }
};


const set = (k, v) =>
  localStorage.setItem(
    K + k,
    JSON.stringify(v)
  );


const t = v =>
  v?.toDate
    ? v.toDate().getTime()
    : new Date(v || 0).getTime();


// NOTICE

$('notice').innerHTML = configured
  ? `
    <b>☁️ Live online mode</b>
    <br>
    <span class="small">
      Orders and stock sync through Firebase.
    </span>
  `
  : `
    <b>📱 Test mode</b>
    <br>
    <span class="small">
      Use the customer app and this Admin Portal on the same phone/browser to test.
      Different phones require Firebase configuration.
    </span>
  `;


// NOTIFICATIONS

function notify(title, msg) {

  if (
    'Notification' in window &&
    Notification.permission === 'granted'
  ) {
    new Notification(title, {
      body: msg
    });
  }

}


// SHOW ADMIN PANEL

function showPanel() {

  $('loginCard').classList.add('hidden');

  $('panel').classList.remove('hidden');

  window.loadAll();

}


// ADMIN LOGIN

window.adminLogin = async () => {

  const em = $('email').value.trim();

  const pw = $('password').value;


  if (!configured) {

    if (
      em === 'admin@skmedkart.local' &&
      pw === '1234'
    ) {
      showPanel();
      return;
    }

    alert(
      'Demo login: admin@skmedkart.local / 1234'
    );

    return;

  }


  try {

    await signInWithEmailAndPassword(
      auth,
      em,
      pw
    );

  } catch (e) {

    alert(
      'Login failed: ' + e.message
    );

  }

};


// ADMIN LOGOUT

window.adminLogout = () => {

  if (configured) {

    signOut(auth);

  } else {

    $('panel').classList.add('hidden');

    $('loginCard').classList.remove('hidden');

  }

};


// AUTH STATE

if (configured) {

  onAuthStateChanged(auth, u => {

    if (!u) {

      $('panel').classList.add('hidden');

      $('loginCard').classList.remove('hidden');

      return;

    }


    if (
      admins.length &&
      !admins.includes(u.email)
    ) {

      alert(
        'This account is not authorized as admin.'
      );

      signOut(auth);

      return;

    }


    showPanel();

  });

}


// =====================================================
// REFRESH
// =====================================================
//
// இந்த function தான் Refresh button-க்கு முக்கியமான fix.
//
// HTML:
// onclick="loadAll()"
//
// அதனால் window.loadAll ஆக இருக்க வேண்டும்.
// Firebase mode-ல் ஒவ்வொரு Refresh click-க்கும்
// Firestore-லிருந்து latest data மீண்டும் fetch ஆகும்.
//
// =====================================================

window.loadAll = async () => {

  try {

    // DEMO / LOCAL MODE

    if (!configured) {

      products = get('products', []);

      currentOrders = get('orders', []);

      render();

      return;

    }


    // FIREBASE MODE
    // REFRESH BUTTON அழுத்தும்போது
    // புதிய orders மற்றும் products நேரடியாக மீண்டும் fetch ஆகும்

    const [ordersSnap, productsSnap] =
      await Promise.all([

        getDocs(
          collection(db, 'orders')
        ),

        getDocs(
          collection(db, 'products')
        )

      ]);


    currentOrders =
      ordersSnap.docs
        .map(d => ({
          id: d.id,
          ...d.data()
        }))
        .sort(
          (a, b) =>
            t(b.createdAt) - t(a.createdAt)
        );


    products =
      productsSnap.docs
        .map(d => ({
          id: d.id,
          ...d.data()
        }));


    render();


    // Live listener ஒருமுறை மட்டும் start ஆகும்

    if (!liveStarted) {

      listenLive();

    }


  } catch (e) {

    console.error(
      'Refresh failed:',
      e
    );

    alert(
      'Refresh failed: ' + e.message
    );

  }

};


// =====================================================
// LIVE FIREBASE LISTENERS
// =====================================================

function listenLive() {

  if (liveStarted) return;


  liveStarted = true;


  let first = true;


  // LIVE ORDERS

  onSnapshot(

    collection(db, 'orders'),

    s => {

      const prev =
        currentOrders.length;


      currentOrders =
        s.docs
          .map(d => ({
            id: d.id,
            ...d.data()
          }))
          .sort(
            (a, b) =>
              t(b.createdAt) -
              t(a.createdAt)
          );


      if (
        !first &&
        currentOrders.length > prev
      ) {

        notify(
          'SKMedKART New Order',
          'A new customer order has arrived.'
        );

      }


      first = false;


      render();

    },


    e => {

      $('orders').innerHTML =
        '<div class="warning">Orders error: ' +
        esc(e.message) +
        '</div>';

    }

  );


  // LIVE PRODUCTS

  onSnapshot(

    collection(db, 'products'),

    s => {

      products =
        s.docs.map(d => ({
          id: d.id,
          ...d.data()
        }));


      render();

    },

    () => {}

  );

}


// =====================================================
// RENDER DASHBOARD
// =====================================================

function render() {

  const low =
    products.filter(
      p =>
        Number(p.stock || 0) <=
        Number(p.lowStockLevel || 10)
    );


  $('newCount').textContent =
    currentOrders.filter(
      o =>
        ![
          'Delivered',
          'Rejected'
        ].includes(o.status)
    ).length;


  $('lowCount').textContent =
    low.length;


  $('prodCount').textContent =
    products.length;


  let alerts;


  if (configured) {

    alerts =
      currentOrders
        .filter(
          o =>
            [
              'Order Placed',
              'Prescription Under Pharmacist Review'
            ].includes(o.status)
        )
        .map(
          o => ({
            type: 'Order',
            message:
              o.orderNumber +
              ' • ' +
              (o.customer?.name || '')
          })
        );

  } else {

    alerts =
      get('adminAlerts', [])
        .filter(
          a => !a.read
        );

  }


  $('alerts').innerHTML =
    alerts
      .map(
        a =>
          '<div class="card">' +
          '<b>' +
          esc(a.type) +
          '</b><br>' +
          esc(a.message) +
          '</div>'
      )
      .join('')
    ||
    '<div class="small">No unread notifications.</div>';


  renderOrders();

  renderStock();

}


// ORDER STATUS OPTIONS

function opts(cur) {

  return [

    'Order Placed',

    'Prescription Under Pharmacist Review',

    'Confirmed',

    'Payment Pending',

    'Ready',

    'Out for Delivery',

    'Delivered',

    'Need Clarification'

  ]
    .map(
      s =>
        '<option ' +
        (s === cur ? 'selected' : '') +
        '>' +
        s +
        '</option>'
    )
    .join('');

}


// =====================================================
// RENDER ORDERS
// =====================================================

function renderOrders() {

  $('orders').innerHTML =
    currentOrders
      .map(o => `

        <div class="order">

          <b>
            ${esc(o.orderNumber || o.id)}
          </b>

          <span class="pill">
            ${esc(o.status)}
          </span>

          <br>

          <span class="small">

            ${
              o.createdAt?.toDate
                ? o.createdAt.toDate().toLocaleString()
                : esc(o.createdAt || '')
            }

          </span>


          <h4>

            ${esc(o.customer?.name)}

            •

            ${esc(o.customer?.phone)}

          </h4>


          <div>

            ${
              (o.items || [])
                .map(
                  x =>
                    esc(x.name) +
                    ' × ' +
                    x.qty
                )
                .join(', ')
            }

          </div>


          <p>

            <b>Delivery:</b>

            ${esc(o.customer?.delivery)}

            <br>

            <b>Address:</b>

            ${esc(o.customer?.address || '-')}

            <br>

            <b>Payment:</b>

            ${esc(o.payment)}

            •

            ${esc(o.paymentStatus || 'Pending')}

          </p>


          ${
            o.prescription?.url

              ? `
                <p>
                  <a
                    class="link"
                    href="${esc(o.prescription.url)}"
                    target="_blank"
                  >
                    Open uploaded prescription
                  </a>
                </p>
              `

              : (

                o.needsRx

                  ? `
                    <p class="warning">
                      Prescription is required.
                      Verify before confirming.
                    </p>
                  `

                  : ''

              )
          }


          <select id="st_${esc(o.id)}">

            ${opts(o.status)}

          </select>


          <textarea
            id="note_${esc(o.id)}"
            placeholder="Pharmacist note / message to customer"
          >${esc(o.pharmacistNote || '')}</textarea>


          <div class="grid">

            <button
              class="ok"
              onclick="updateOrder('${esc(o.id)}')"
            >
              Save Status
            </button>


            <button
              class="danger"
              onclick="rejectOrder('${esc(o.id)}')"
            >
              Reject / Clarify
            </button>

          </div>

        </div>

      `)
      .join('')
    ||
    '<div class="small">No orders yet.</div>';

}


// =====================================================
// UPDATE ORDER
// =====================================================

window.updateOrder = async id => {

  const st =
    $('st_' + id).value;


  const note =
    $('note_' + id)
      .value
      .trim();


  try {

    if (configured) {

      await updateDoc(

        doc(db, 'orders', id),

        {
          status: st,

          pharmacistNote: note,

          updatedAt:
            serverTimestamp()
        }

      );

    } else {

      let a =
        get('orders', []);


      let o =
        a.find(
          x => x.id === id
        );


      if (o) {

        o.status = st;

        o.pharmacistNote = note;

        o.updatedAt =
          new Date().toISOString();

      }


      set('orders', a);

      currentOrders = a;

      render();

    }


    alert(
      'Order status updated.'
    );


  } catch (e) {

    alert(
      'Could not update order: ' +
      e.message
    );

  }

};


// REJECT / CLARIFY

window.rejectOrder = id => {

  $('st_' + id).value =
    'Need Clarification';


  window.updateOrder(id);

};


// =====================================================
// SAVE PRODUCT
// =====================================================

window.saveProduct = async () => {

  const name =
    $('pname')
      .value
      .trim();


  const price =
    Number(
      $('pprice').value
    );


  const stock =
    Number(
      $('pstock').value
    );


  if (!name) {

    return alert(
      'Enter product name.'
    );

  }


  const p = {

    name,

    cat:
      $('pcat').value,

    price:
      Number.isFinite(price)
        ? price
        : 0,

    stock:
      Number.isFinite(stock)
        ? stock
        : 0,

    lowStockLevel: 10,

    icon:
      $('picon')
        .value
        .trim() || '💊',

    rx:
      $('prx').checked,

    active: true,

    createdAt:
      configured
        ? serverTimestamp()
        : new Date().toISOString()

  };


  try {

    if (configured) {

      const pid =
        String(
          (name + '__').toLowerCase()
        )
          .replace(
            /[^a-z0-9]+/g,
            '_'
          )
          .replace(
            /^_|_$/g,
            ''
          )
          .slice(
            0,
            120
          )
        ||
        (
          'product_' +
          Date.now()
        );


      await setDoc(

        doc(
          db,
          'products',
          pid
        ),

        p,

        {
          merge: true
        }

      );


    } else {

      const a =
        get('products', []);


      p.id =
        'P' + Date.now();


      a.push(p);


      set(
        'products',
        a
      );


      products = a;


      render();

    }


    $('pname').value =
      '';


    $('pprice').value =
      '';


    $('pstock').value =
      '';


    $('picon').value =
      '';


    $('prx').checked =
      false;


    alert(
      'Product added to customer catalogue.'
    );


  } catch (e) {

    alert(
      'Could not save product: ' +
      e.message
    );

  }

};


// =====================================================
// RENDER STOCK
// =====================================================

function renderStock() {

  $('stockList').innerHTML =
    products
      .map(p => `

        <div class="card">

          <div class="row">

            <div>

              <b>
                ${esc(p.name)}
              </b>

              <br>

              <span class="small">

                ${esc(p.cat)}

                •

                Current stock:

                ${Number(p.stock || 0)}

              </span>

            </div>


            <span
              class="${
                Number(p.stock || 0) <=
                Number(p.lowStockLevel || 10)

                  ? 'warning'

                  : 'pill'
              }"
            >

              ${
                Number(p.stock || 0) <=
                Number(p.lowStockLevel || 10)

                  ? 'Low Stock'

                  : 'Available'
              }

            </span>

          </div>


          <div class="grid">

            <input
              id="stock_${esc(p.id)}"
              type="number"
              min="0"
              value="${Number(p.stock || 0)}"
            >


            <button
              onclick="updateStock('${esc(p.id)}')"
            >
              Update Stock
            </button>

          </div>

        </div>

      `)
      .join('')
    ||
    '<div class="small">No products added yet.</div>';

}


// =====================================================
// UPDATE STOCK
// =====================================================

window.updateStock = async id => {

  const value =
    Math.max(

      0,

      Number(
        $('stock_' + id).value
      ) || 0

    );


  try {

    if (configured) {

      await updateDoc(

        doc(
          db,
          'products',
          id
        ),

        {

          stock: value,

          updatedAt:
            serverTimestamp()

        }

      );


    } else {

      let a =
        get(
          'products',
          []
        );


      let p =
        a.find(
          x => x.id === id
        );


      if (p) {

        p.stock = value;

      }


      set(
        'products',
        a
      );


      products = a;


      render();

    }


    alert(
      'Stock updated. Customer catalogue will refresh from the shared data.'
    );


  } catch (e) {

    alert(
      'Could not update stock: ' +
      e.message
    );

  }

};
