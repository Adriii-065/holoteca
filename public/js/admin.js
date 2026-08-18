const loginShell = document.getElementById('loginShell');
const adminShell = document.getElementById('adminShell');

let allCards = [];
let allOrders = [];
let imagesToRemove = new Set();

function money(n) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

// ---------- Sesión ----------

async function checkSession() {
  const res = await fetch('/api/admin/session');
  const data = await res.json();
  if (data.isAdmin) {
    loginShell.style.display = 'none';
    adminShell.style.display = 'block';
    loadEverything();
  } else {
    loginShell.style.display = 'flex';
    adminShell.style.display = 'none';
  }
}

document.getElementById('loginBtn').addEventListener('click', async () => {
  const username = document.getElementById('loginUser').value.trim();
  const password = document.getElementById('loginPass').value;
  const errorBox = document.getElementById('loginError');
  errorBox.innerHTML = '';

  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) {
      errorBox.innerHTML = `<div class="notice error">${escapeHtml(data.error)}</div>`;
      return;
    }
    checkSession();
  } catch {
    errorBox.innerHTML = `<div class="notice error">No se pudo conectar con el servidor.</div>`;
  }
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await fetch('/api/admin/logout', { method: 'POST' });
  checkSession();
});

// ---------- Tabs ----------

document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.panel-section').forEach((s) => s.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
  });
});

// ---------- Carga de datos ----------

async function fetchCards() {
  const res = await fetch('/api/cards/admin/all');
  return res.json();
}

async function fetchOrders() {
  const res = await fetch('/api/admin/orders');
  return res.json();
}

async function fetchSettings() {
  const res = await fetch('/api/admin/settings');
  return res.json();
}

async function loadEverything() {
  allCards = await fetchCards();
  allOrders = await fetchOrders();
  renderCardsTable();
  renderOrdersTable();
  renderStats();
  const settings = await fetchSettings();
  fillSettingsForm(settings);
  await renderPendingPrices();
}

function renderStats() {
  const available = allCards.filter((c) => c.status === 'available').length;
  const sold = allCards.filter((c) => c.status === 'sold').length;
  const revenue = allOrders
    .filter((o) => o.status === 'paid')
    .reduce((sum, o) => sum + o.total, 0);

  document.getElementById('statRow').innerHTML = `
    <div class="stat-card"><div class="value">${available}</div><div class="label">En venta</div></div>
    <div class="stat-card"><div class="value">${sold}</div><div class="label">Vendidas</div></div>
    <div class="stat-card"><div class="value">${money(revenue)}</div><div class="label">Ingresos</div></div>
  `;
}

function statusBadge(status) {
  const labels = {
    available: 'En venta',
    reserved: 'Reservada',
    sold: 'Vendida',
    pending: 'Pendiente',
    paid: 'Pagado',
    cancelled: 'Cancelado',
    expired: 'Caducado'
  };
  return `<span class="badge ${status}">${labels[status] || status}</span>`;
}

function renderCardsTable() {
  const tbody = document.getElementById('cardsTableBody');
  if (allCards.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="color:var(--muted);">Todavía no has subido ninguna carta.</td></tr>`;
    return;
  }

  tbody.innerHTML = allCards
    .map(
      (card) => `
    <tr>
      <td>${card.images[0] ? `<img class="thumb" src="${card.images[0]}">` : ''}</td>
      <td>
        <strong>${escapeHtml(card.name)}</strong><br>
        <span style="color:var(--muted);font-size:0.8rem;">${escapeHtml(card.set || '')} ${card.number ? '· ' + escapeHtml(card.number) : ''}</span>
      </td>
      <td>${money(card.price)}</td>
      <td>${statusBadge(card.status)}</td>
      <td>
        <div class="row-actions">
          <button data-edit="${card.id}">Editar</button>
          <button data-delete="${card.id}" class="danger">Borrar</button>
        </div>
      </td>
    </tr>
  `
    )
    .join('');

  tbody.querySelectorAll('[data-edit]').forEach((btn) => {
    btn.addEventListener('click', () => startEdit(btn.dataset.edit));
  });
  tbody.querySelectorAll('[data-delete]').forEach((btn) => {
    btn.addEventListener('click', () => deleteCard(btn.dataset.delete));
  });
}

function renderOrdersTable() {
  const tbody = document.getElementById('ordersTableBody');
  if (allOrders.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="color:var(--muted);">Todavía no hay pedidos.</td></tr>`;
    return;
  }

  tbody.innerHTML = allOrders
    .map(
      (order) => `
    <tr>
      <td><span style="font-family:var(--font-mono);">${order.reference}</span></td>
      <td>${escapeHtml(order.buyerName)}<br><span style="color:var(--muted);font-size:0.8rem;">${escapeHtml(order.buyerContact)}</span></td>
      <td>${order.method === 'bizum' ? 'Bizum' : 'PayPal'}</td>
      <td>${money(order.total)}</td>
      <td>${statusBadge(order.status)}</td>
      <td>
        ${
          order.status === 'pending' && order.method === 'bizum'
            ? `<div class="row-actions">
                 <button data-confirm="${order.id}">Marcar pagado</button>
                 <button data-cancel="${order.id}" class="danger">Cancelar</button>
               </div>`
            : ''
        }
      </td>
    </tr>
  `
    )
    .join('');

  tbody.querySelectorAll('[data-confirm]').forEach((btn) => {
    btn.addEventListener('click', () => resolveOrder(btn.dataset.confirm, 'confirm'));
  });
  tbody.querySelectorAll('[data-cancel]').forEach((btn) => {
    btn.addEventListener('click', () => resolveOrder(btn.dataset.cancel, 'cancel'));
  });
}

async function resolveOrder(id, action) {
  await fetch(`/api/admin/orders/${id}/${action}`, { method: 'POST' });
  await loadEverything();
}

// ---------- Formulario de carta (crear / editar) ----------

const form = document.getElementById('cardForm');
const submitBtn = document.getElementById('cardFormSubmit');
const cancelEditBtn = document.getElementById('cancelEdit');

function resetForm() {
  form.reset();
  document.getElementById('editingId').value = '';
  document.getElementById('existingThumbs').innerHTML = '';
  document.getElementById('formError').innerHTML = '';
  imagesToRemove = new Set();
  submitBtn.textContent = 'Publicar carta';
  cancelEditBtn.style.display = 'none';
  clearPokemonLink();
  document.getElementById('f-autosync').checked = false;
  document.getElementById('autoSyncBlock').style.display = 'none';
  document.getElementById('f-margin').value = '';
}

function startEdit(id) {
  const card = allCards.find((c) => c.id === id);
  if (!card) return;

  document.getElementById('editingId').value = card.id;
  document.getElementById('f-name').value = card.name;
  document.getElementById('f-price').value = card.price;
  document.getElementById('f-set').value = card.set || '';
  document.getElementById('f-number').value = card.number || '';
  document.getElementById('f-condition').value = card.condition;
  document.getElementById('f-type').value = card.productType || 'Carta individual';
  document.getElementById('f-language').value = card.language || 'Español';
  document.getElementById('f-description').value = card.description || '';

  document.getElementById('f-autosync').checked = !!card.autoPriceSync;
  document.getElementById('autoSyncBlock').style.display = card.autoPriceSync ? 'block' : 'none';
  document.getElementById('f-margin').value = card.priceMarginPercent || 0;
  if (card.pokemonTcgId) {
    setPokemonLink(card.pokemonTcgId, card.pokemonTcgName || card.name);
  } else {
    clearPokemonLink();
  }

  imagesToRemove = new Set();
  const thumbs = document.getElementById('existingThumbs');
  thumbs.innerHTML = card.images
    .map(
      (img) => `
    <div class="existing-thumb" data-path="${img}">
      <img src="${img}">
      <button type="button" class="rm" title="Quitar imagen">✕</button>
    </div>
  `
    )
    .join('');

  thumbs.querySelectorAll('.existing-thumb').forEach((el) => {
    el.querySelector('.rm').addEventListener('click', () => {
      const path = el.dataset.path;
      if (imagesToRemove.has(path)) {
        imagesToRemove.delete(path);
        el.style.opacity = '1';
      } else {
        imagesToRemove.add(path);
        el.style.opacity = '0.3';
      }
    });
  });

  submitBtn.textContent = 'Guardar cambios';
  cancelEditBtn.style.display = 'inline-block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

cancelEditBtn.addEventListener('click', resetForm);

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorBox = document.getElementById('formError');
  errorBox.innerHTML = '';

  const editingId = document.getElementById('editingId').value;
  const fd = new FormData();
  fd.append('name', document.getElementById('f-name').value.trim());
  fd.append('price', document.getElementById('f-price').value);
  fd.append('set', document.getElementById('f-set').value.trim());
  fd.append('number', document.getElementById('f-number').value.trim());
  fd.append('condition', document.getElementById('f-condition').value);
  fd.append('productType', document.getElementById('f-type').value);
  fd.append('language', document.getElementById('f-language').value);
  fd.append('description', document.getElementById('f-description').value.trim());
  fd.append('autoPriceSync', document.getElementById('f-autosync').checked ? 'true' : 'false');
  fd.append('priceMarginPercent', document.getElementById('f-margin').value || '0');
  fd.append('pokemonTcgId', document.getElementById('f-pokemontcg-id').value);
  fd.append('pokemonTcgName', document.getElementById('f-pokemontcg-name').value);

  const files = document.getElementById('f-images').files;
  for (const file of files) fd.append('images', file);

  if (editingId) {
    imagesToRemove.forEach((path) => fd.append('removeImages', path));
  }

  const url = editingId ? `/api/cards/admin/${editingId}` : '/api/cards/admin';
  const method = editingId ? 'PUT' : 'POST';

  submitBtn.disabled = true;
  try {
    const res = await fetch(url, { method, body: fd });
    const data = await res.json();
    if (!res.ok) {
      errorBox.innerHTML = `<div class="notice error">${escapeHtml(data.error)}</div>`;
      return;
    }
    resetForm();
    await loadEverything();
  } catch {
    errorBox.innerHTML = `<div class="notice error">No se pudo conectar con el servidor.</div>`;
  } finally {
    submitBtn.disabled = false;
  }
});

async function deleteCard(id) {
  if (!confirm('¿Seguro que quieres borrar esta carta? No se puede deshacer.')) return;
  await fetch(`/api/cards/admin/${id}`, { method: 'DELETE' });
  await loadEverything();
}

// ---------- Ajustes de cobro (Bizum / PayPal) ----------

function fillSettingsForm(settings) {
  document.getElementById('s-bizum-phone').value = settings.bizumPhone || '';
  document.getElementById('s-bizum-name').value = settings.bizumHolderName || '';
  document.getElementById('s-bizum-minutes').value = settings.bizumReserveMinutes || 60;
  document.getElementById('s-paypal-mode').value = settings.paypalMode || 'sandbox';
  document.getElementById('s-paypal-clientid').value = settings.paypalClientId || '';
  document.getElementById('s-paypal-secret').value = settings.paypalSecret || '';
  document.getElementById('s-cloud-name').value = settings.cloudinaryCloudName || '';
  document.getElementById('s-cloud-key').value = settings.cloudinaryApiKey || '';
  document.getElementById('s-cloud-secret').value = settings.cloudinaryApiSecret || '';
  document.getElementById('s-pokemontcg-key').value = settings.pokemonTcgApiKey || '';
  document.getElementById('s-price-threshold').value = settings.priceAutoThresholdPercent ?? 15;
}

document.getElementById('toggleSecretVisibility').addEventListener('click', (e) => {
  const input = document.getElementById('s-paypal-secret');
  const showing = input.type === 'text';
  input.type = showing ? 'password' : 'text';
  e.target.textContent = showing ? 'Mostrar' : 'Ocultar';
});

document.getElementById('toggleCloudSecretVisibility').addEventListener('click', (e) => {
  const input = document.getElementById('s-cloud-secret');
  const showing = input.type === 'text';
  input.type = showing ? 'password' : 'text';
  e.target.textContent = showing ? 'Mostrar' : 'Ocultar';
});

document.getElementById('settingsForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('settingsMsg');
  msg.innerHTML = '';

  const payload = {
    bizumPhone: document.getElementById('s-bizum-phone').value.trim(),
    bizumHolderName: document.getElementById('s-bizum-name').value.trim(),
    bizumReserveMinutes: Number(document.getElementById('s-bizum-minutes').value) || 60,
    paypalMode: document.getElementById('s-paypal-mode').value,
    paypalClientId: document.getElementById('s-paypal-clientid').value.trim(),
    paypalSecret: document.getElementById('s-paypal-secret').value.trim(),
    cloudinaryCloudName: document.getElementById('s-cloud-name').value.trim(),
    cloudinaryApiKey: document.getElementById('s-cloud-key').value.trim(),
    cloudinaryApiSecret: document.getElementById('s-cloud-secret').value.trim(),
    pokemonTcgApiKey: document.getElementById('s-pokemontcg-key').value.trim(),
    priceAutoThresholdPercent: Number(document.getElementById('s-price-threshold').value) || 15
  };

  try {
    const res = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      msg.innerHTML = `<div class="notice error">${escapeHtml(data.error || 'No se pudo guardar.')}</div>`;
      return;
    }
    fillSettingsForm(data);
    msg.innerHTML = `<div class="notice success">Ajustes guardados. Ya se están usando en la tienda.</div>`;
  } catch {
    msg.innerHTML = `<div class="notice error">No se pudo conectar con el servidor.</div>`;
  }
});

// ---------- Vincular carta con pokemontcg.io ----------

document.getElementById('f-autosync').addEventListener('change', (e) => {
  document.getElementById('autoSyncBlock').style.display = e.target.checked ? 'block' : 'none';
});

function setPokemonLink(id, name) {
  document.getElementById('f-pokemontcg-id').value = id;
  document.getElementById('f-pokemontcg-name').value = name;
  const info = document.getElementById('pokemonLinkedInfo');
  info.style.display = 'block';
  info.innerHTML = `
    <div class="notice success" style="margin-bottom:0;display:flex;justify-content:space-between;align-items:center;gap:10px;">
      <span>Vinculada con: <strong>${escapeHtml(name)}</strong></span>
      <button type="button" class="btn-secondary" id="unlinkPokemonBtn">Quitar vínculo</button>
    </div>
  `;
  document.getElementById('unlinkPokemonBtn').addEventListener('click', clearPokemonLink);
  document.getElementById('pokemonSearchResults').innerHTML = '';
}

function clearPokemonLink() {
  document.getElementById('f-pokemontcg-id').value = '';
  document.getElementById('f-pokemontcg-name').value = '';
  const info = document.getElementById('pokemonLinkedInfo');
  info.style.display = 'none';
  info.innerHTML = '';
}

document.getElementById('pokemonSearchBtn').addEventListener('click', async () => {
  const q = document.getElementById('f-pokemontcg-search').value.trim();
  const results = document.getElementById('pokemonSearchResults');
  if (!q) return;

  results.innerHTML = `<p style="color:var(--muted);font-size:0.85rem;">Buscando...</p>`;

  try {
    const res = await fetch(`/api/admin/prices/search?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    if (!res.ok) {
      results.innerHTML = `<div class="notice error">${escapeHtml(data.error || 'No se pudo buscar.')}</div>`;
      return;
    }
    if (data.length === 0) {
      results.innerHTML = `<p style="color:var(--muted);font-size:0.85rem;">Sin resultados. Prueba con otro nombre.</p>`;
      return;
    }

    results.innerHTML = data
      .map(
        (c, i) => `
      <div class="existing-thumb" data-i="${i}" style="display:flex;align-items:center;gap:10px;border:1px solid var(--line);border-radius:8px;padding:8px;margin-top:6px;cursor:pointer;width:100%;">
        ${c.image ? `<img src="${c.image}" style="width:36px;height:50px;object-fit:cover;border-radius:4px;">` : ''}
        <div style="flex:1;">
          <div style="font-weight:600;font-size:0.88rem;">${escapeHtml(c.name)}</div>
          <div style="color:var(--muted);font-size:0.78rem;">${escapeHtml(c.setName)} · #${escapeHtml(c.number)}</div>
        </div>
        <div style="font-family:var(--font-mono);font-size:0.85rem;color:var(--gold);">
          ${c.marketPrice != null ? money(c.marketPrice) : 'sin precio'}
        </div>
      </div>
    `
      )
      .join('');

    results.querySelectorAll('[data-i]').forEach((el) => {
      el.addEventListener('click', () => {
        const c = data[Number(el.dataset.i)];
        setPokemonLink(c.id, `${c.name} (${c.setName} #${c.number})`);
      });
    });
  } catch {
    results.innerHTML = `<div class="notice error">No se pudo conectar con el servidor.</div>`;
  }
});

// ---------- Pestaña Precios ----------

async function fetchPendingPrices() {
  const res = await fetch('/api/admin/prices/pending');
  return res.json();
}

async function renderPendingPrices() {
  const pending = await fetchPendingPrices();
  const tbody = document.getElementById('pendingPricesBody');

  if (pending.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="color:var(--muted);">No hay cambios pendientes de revisar.</td></tr>`;
    return;
  }

  tbody.innerHTML = pending
    .map(
      (p) => `
    <tr>
      <td>${escapeHtml(p.name)}</td>
      <td>${money(p.currentPrice)}</td>
      <td style="font-weight:600;">${money(p.pendingPrice)}</td>
      <td style="color:var(--muted);">${money(p.pendingPriceMarket)}</td>
      <td>
        <div class="row-actions">
          <button data-approve="${p.id}">Aplicar</button>
          <button data-dismiss="${p.id}" class="danger">Descartar</button>
        </div>
      </td>
    </tr>
  `
    )
    .join('');

  tbody.querySelectorAll('[data-approve]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await fetch(`/api/admin/prices/${btn.dataset.approve}/approve`, { method: 'POST' });
      await renderPendingPrices();
      await loadEverything();
    });
  });
  tbody.querySelectorAll('[data-dismiss]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await fetch(`/api/admin/prices/${btn.dataset.dismiss}/dismiss`, { method: 'POST' });
      await renderPendingPrices();
    });
  });
}

document.getElementById('runSyncBtn').addEventListener('click', async () => {
  const btn = document.getElementById('runSyncBtn');
  const status = document.getElementById('syncStatus');
  const summary = document.getElementById('syncSummary');
  btn.disabled = true;
  status.textContent = 'Sincronizando...';
  summary.innerHTML = '';

  try {
    const res = await fetch('/api/admin/prices/run', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) {
      summary.innerHTML = `<div class="notice error">${escapeHtml(data.error || 'No se pudo sincronizar.')}</div>`;
      return;
    }
    status.textContent = '';
    summary.innerHTML = `
      <div class="notice success">
        Revisadas ${data.checked} cartas · ${data.updated.length} actualizadas automáticamente ·
        ${data.pending.length} pendientes de revisar ${data.failed.length ? `· ${data.failed.length} con error` : ''}
      </div>
    `;
    await renderPendingPrices();
    await loadEverything();
  } catch {
    summary.innerHTML = `<div class="notice error">No se pudo conectar con el servidor.</div>`;
  } finally {
    btn.disabled = false;
  }
});

// ---------- Init ----------

checkSession();
