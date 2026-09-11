// app.js
// WHAT IS THIS FILE?
//   All the frontend logic: switching tabs, submitting the order
//   form, loading the dashboard, searching, and updating status.
//   Plain JavaScript, no framework or build step - just open
//   index.html (served by the backend) and it works.
// DO I NEED TO CHANGE ANYTHING?
//   No, unless you want to change how the screens behave.

const API_BASE = '/api';

// ---------- small helpers ----------
function $(selector, root = document) { return root.querySelector(selector); }
function $all(selector, root = document) { return [...root.querySelectorAll(selector)]; }

function ddmmyyyyFromInputDate(inputDate) {
  // <input type="date"> gives "YYYY-MM-DD" - backend wants "DD-MM-YYYY"
  const [y, m, d] = inputDate.split('-');
  return `${d}-${m}-${y}`;
}

async function api(path, options = {}) {
  const res = await fetch(API_BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error((data.errors && data.errors.join(' ')) || 'Request failed');
    err.data = data;
    throw err;
  }
  return data;
}

// ---------- tabs ----------
function showTab(tabName) {
  $all('.tab').forEach((t) => t.classList.toggle('is-active', t.dataset.tab === tabName));
  $all('.screen').forEach((s) => s.classList.toggle('is-active', s.id === tabName));
  if (tabName === 'dashboard') loadDashboard();
}
$all('.tab').forEach((t) => t.addEventListener('click', () => showTab(t.dataset.tab)));

// ---------- store name ----------
api('/health')
  .then((data) => { if (data.store) $('#storeName').textContent = data.store; })
  .catch(() => {});

// ---------- new order form ----------
const form = $('#orderForm');
const formErrors = $('#formErrors');
const reminderPreview = $('#reminderPreview');

function updateReminderPreview() {
  const date = form.pickupDateInput.value;
  const time = form.pickupTimeInput.value;
  if (!date || !time) { reminderPreview.textContent = ''; return; }
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m - 30;
  const rh = Math.floor(((total % 1440) + 1440) % 1440 / 60);
  const rm = ((total % 60) + 60) % 60;
  const ampm = (h2) => (h2 % 24 < 12 ? 'AM' : 'PM');
  const to12 = (h2, m2) => {
    const hh = ((h2 % 12) || 12);
    return `${String(hh).padStart(2, '0')}:${String(m2).padStart(2, '0')} ${ampm(h2)}`;
  };
  reminderPreview.textContent = `A reminder will be sent at ${to12(rh, rm)} (30 minutes before pickup).`;
}
form.pickupDateInput.addEventListener('change', updateReminderPreview);
form.pickupTimeInput.addEventListener('change', updateReminderPreview);

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  formErrors.classList.add('is-hidden');
  formErrors.textContent = '';

  const submitBtn = $('#submitBtn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Placing order…';

  const payload = {
    customerName: form.customerName.value,
    phone: form.phone.value,
    whatsappNumber: form.whatsappNumber.value,
    email: form.email.value,
    product: form.product.value,
    quantity: form.quantity.value,
    notes: form.notes.value,
    orderType: form.orderType.value,
    pickupDate: ddmmyyyyFromInputDate(form.pickupDateInput.value),
    pickupTime: form.pickupTimeInput.value
  };

  try {
    const data = await api('/orders', { method: 'POST', body: JSON.stringify(payload) });
    showSuccess(data);
    form.reset();
    reminderPreview.textContent = '';
  } catch (err) {
    formErrors.textContent = (err.data && err.data.errors && err.data.errors.join(' ')) || err.message;
    formErrors.classList.remove('is-hidden');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Place Order';
  }
});

function showSuccess(data) {
  $('#successOrderId').textContent = `Order ID: ${data.order['Order ID']}`;
  $('#successThankYou').textContent = data.thankYouSent ? 'Sent' : 'Failed to send';
  $('#successReminder').textContent = `Scheduled for ${data.reminderScheduledFor}`;

  const warning = $('#successWarning');
  if (!data.thankYouSent) {
    warning.textContent = `The order was saved, but the thank-you message could not be sent (${data.thankYouError || 'unknown error'}). You can resend it manually if needed.`;
    warning.classList.remove('is-hidden');
  } else {
    warning.classList.add('is-hidden');
  }

  $all('.tab').forEach((t) => t.classList.remove('is-active'));
  $all('.screen').forEach((s) => s.classList.remove('is-active'));
  $('#success').classList.add('is-active');
}
$('#newOrderAgainBtn').addEventListener('click', () => showTab('new-order'));

// ---------- dashboard ----------
function orderCardHTML(order) {
  const label = order['Order Type'] === 'Delivery' ? 'Delivery' : 'Pickup';
  return `
    <div class="order-card" data-id="${order['Order ID']}">
      <div class="order-card__main">
        <div class="order-card__id">${order['Order ID']}</div>
        <div class="order-card__name">${order['Customer Name']}</div>
        <div class="order-card__meta">${order['Product']} · ${label} ${order['Pickup Time']}</div>
      </div>
      <span class="status-pill status-${order['Status']}">${order['Status']}</span>
    </div>
  `;
}

function todayDDMMYYYY() {
  const now = new Date();
  const d = String(now.getDate()).padStart(2, '0');
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${d}-${m}-${now.getFullYear()}`;
}

function parseDDMMYYYY(str) {
  const [d, m, y] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

async function loadDashboard() {
  const todayList = $('#todayList');
  const upcomingList = $('#upcomingList');
  todayList.innerHTML = '<p class="empty">Loading…</p>';
  upcomingList.innerHTML = '';

  try {
    const { orders } = await api('/orders');
    const today = todayDDMMYYYY();
    const todayDate = parseDDMMYYYY(today);

    const todays = orders.filter((o) => o['Pickup Date'] === today);
    const upcoming = orders
      .filter((o) => o['Pickup Date'] !== today && parseDDMMYYYY(o['Pickup Date']) > todayDate)
      .sort((a, b) => parseDDMMYYYY(a['Pickup Date']) - parseDDMMYYYY(b['Pickup Date']));

    todayList.innerHTML = todays.length
      ? todays.map(orderCardHTML).join('')
      : '<p class="empty">No orders for today.</p>';

    upcomingList.innerHTML = upcoming.length
      ? upcoming.map(orderCardHTML).join('')
      : '<p class="empty">No upcoming orders.</p>';

    attachCardHandlers();
  } catch (err) {
    todayList.innerHTML = `<p class="empty">Could not load orders (${err.message}).</p>`;
  }
}

// ---------- search ----------
let searchTimer = null;
$('#searchInput').addEventListener('input', (e) => {
  clearTimeout(searchTimer);
  const q = e.target.value.trim();
  searchTimer = setTimeout(() => runSearch(q), 250);
});

async function runSearch(query) {
  const results = $('#searchResults');
  if (!query) { results.innerHTML = ''; return; }
  results.innerHTML = '<p class="empty">Searching…</p>';
  try {
    const { orders } = await api(`/orders?search=${encodeURIComponent(query)}`);
    results.innerHTML = orders.length
      ? orders.map(orderCardHTML).join('')
      : '<p class="empty">No matching orders.</p>';
    attachCardHandlers();
  } catch (err) {
    results.innerHTML = `<p class="empty">Search failed (${err.message}).</p>`;
  }
}

// ---------- order detail modal ----------
const modal = $('#orderModal');
const modalBody = $('#modalBody');
const STATUSES = ['Pending', 'Confirmed', 'Ready', 'Completed', 'Cancelled'];

function attachCardHandlers() {
  $all('.order-card').forEach((card) => {
    card.addEventListener('click', () => openOrderModal(card.dataset.id));
  });
}

async function openOrderModal(orderId) {
  modalBody.innerHTML = '<p class="empty">Loading…</p>';
  modal.classList.remove('is-hidden');
  try {
    const { order } = await api(`/orders/${encodeURIComponent(orderId)}`);
    modalBody.innerHTML = `
      <h3>${order['Order ID']}</h3>
      <p>${order['Customer Name']} · ${order['Phone']}</p>
      <dl>
        <div><dt>Product</dt><dd>${order['Product']} × ${order['Quantity']}</dd></div>
        <div><dt>Type</dt><dd>${order['Order Type']}</dd></div>
        <div><dt>Pickup</dt><dd>${order['Pickup Date']} ${order['Pickup Time']}</dd></div>
        <div><dt>Reminder</dt><dd>${order['Reminder DateTime']}</dd></div>
        <div><dt>Thank-you sent</dt><dd>${order['Thank You Sent']}</dd></div>
        <div><dt>Reminder sent</dt><dd>${order['Reminder Sent']}</dd></div>
        <div><dt>Notes</dt><dd>${order['Notes'] || '—'}</dd></div>
      </dl>
      <div class="status-actions">
        ${STATUSES.map(
          (s) => `<button class="btn btn--small ${s === order['Status'] ? 'btn--primary' : 'btn--secondary'}" data-status="${s}">${s}</button>`
        ).join('')}
      </div>
    `;
    $all('.status-actions button', modalBody).forEach((btn) => {
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        try {
          await api(`/orders/${encodeURIComponent(orderId)}`, {
            method: 'PUT',
            body: JSON.stringify({ status: btn.dataset.status })
          });
          openOrderModal(orderId);
          loadDashboard();
        } catch (err) {
          alert('Could not update status: ' + err.message);
          btn.disabled = false;
        }
      });
    });
  } catch (err) {
    modalBody.innerHTML = `<p class="empty">Could not load order (${err.message}).</p>`;
  }
}

$('#modalClose').addEventListener('click', () => modal.classList.add('is-hidden'));
modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.add('is-hidden'); });

// ---------- initial load ----------
loadDashboard();
