const CART_KEY = 'holoteca_cart';

const els = {
  grid: document.getElementById('grid'),
  emptyState: document.getElementById('emptyState'),
  cartCount: document.getElementById('cartCount'),
  cartItems: document.getElementById('cartItems'),
  cartTotal: document.getElementById('cartTotal'),
  goCheckout: document.getElementById('goCheckout'),

  openCart: document.getElementById('openCart'),
  closeCart: document.getElementById('closeCart'),
  cartOverlay: document.getElementById('cartOverlay'),
  cartDrawer: document.getElementById('cartDrawer'),

  detailOverlay: document.getElementById('detailOverlay'),
  detailModal: document.getElementById('detailModal'),
  detailName: document.getElementById('detailName'),
  detailBody: document.getElementById('detailBody'),
  closeDetail: document.getElementById('closeDetail'),

  sortSelect: document.getElementById('sortSelect'),
  languageFilter: document.getElementById('languageFilter'),

  checkoutOverlay: document.getElementById('checkoutOverlay'),
  checkoutModal: document.getElementById('checkoutModal'),
  checkoutBody: document.getElementById('checkoutBody'),
  closeCheckout: document.getElementById('closeCheckout')
};

let cardsCache = [];
let currentSort = 'recent';
let currentLanguageFilter = 'all';

function getVisibleCards() {
  let cards = [...cardsCache];

  if (currentLanguageFilter !== 'all') {
    cards = cards.filter((c) => (c.language || 'Español') === currentLanguageFilter);
  }

  if (currentSort === 'price-asc') {
    cards.sort((a, b) => a.price - b.price);
  } else if (currentSort === 'price-desc') {
    cards.sort((a, b) => b.price - a.price);
  } else if (currentSort === 'views') {
    cards.sort((a, b) => (b.views || 0) - (a.views || 0));
  }
  // 'recent' ya viene ordenado por fecha desde el servidor, no hace falta tocarlo.
  return cards;
}

// ---------- Utilidades ----------

function money(n) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n);
}

function getCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY)) || [];
  } catch {
    return [];
  }
}

function setCart(items) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
  renderCart();
}

function addToCart(card) {
  const cart = getCart();
  if (cart.some((c) => c.id === card.id)) return;
  cart.push({ id: card.id, name: card.name, price: card.price, image: card.images[0] || null });
  setCart(cart);
  openCart();
}

function removeFromCart(id) {
  setCart(getCart().filter((c) => c.id !== id));
}

function clearCart() {
  setCart([]);
}

// ---------- Render: grid ----------

async function loadCards() {
  const res = await fetch('/api/cards');
  cardsCache = await res.json();
  renderGrid();
}

function renderGrid() {
  els.grid.innerHTML = '';

  if (cardsCache.length === 0) {
    els.emptyState.textContent = 'Aún no hay cartas a la venta. Vuelve pronto.';
    els.emptyState.style.display = 'block';
    return;
  }

  const cards = getVisibleCards();

  if (cards.length === 0) {
    els.emptyState.textContent = 'No hay cartas que coincidan con ese filtro.';
    els.emptyState.style.display = 'block';
    return;
  }

  els.emptyState.style.display = 'none';

  cards.forEach((card) => {
    const slot = document.createElement('article');
    slot.className = 'slot';

    const media = card.images[0]
      ? `<div class="slot-media"><img src="${card.images[0]}" alt="${escapeHtml(card.name)}" loading="lazy"></div>`
      : `<div class="slot-media no-image">sin imagen</div>`;

    slot.innerHTML = `
      ${media}
      <div class="slot-body">
        <div class="slot-meta">${escapeHtml(card.set || '')} ${card.number ? '· ' + escapeHtml(card.number) : ''}</div>
        <h3 class="slot-name">${escapeHtml(card.name)}</h3>
        <div class="pill-row">
          <span class="slot-condition">${escapeHtml(card.productType || 'Carta individual')}</span>
          <span class="slot-condition">${escapeHtml(card.language || 'Español')}</span>
          <span class="slot-condition">${escapeHtml(card.condition)}</span>
        </div>
        <div class="slot-footer">
          <span class="slot-price">${money(card.price)}</span>
          <button class="slot-add" data-add="${card.id}">Añadir</button>
        </div>
      </div>
    `;

    slot.querySelector('.slot-media').addEventListener('click', () => openDetail(card));
    slot.querySelector('.slot-name').addEventListener('click', () => openDetail(card));
    slot.querySelector('[data-add]').addEventListener('click', (e) => {
      e.stopPropagation();
      addToCart(card);
    });

    els.grid.appendChild(slot);
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

els.sortSelect.addEventListener('change', () => {
  currentSort = els.sortSelect.value;
  renderGrid();
});

els.languageFilter.addEventListener('change', () => {
  currentLanguageFilter = els.languageFilter.value;
  renderGrid();
});

// ---------- Detalle de carta ----------

function openDetail(card) {
  fetch(`/api/cards/${card.id}/view`, { method: 'POST' }).catch(() => {});

  els.detailName.textContent = card.name;
  const img = card.images[0]
    ? `<img src="${card.images[0]}" alt="${escapeHtml(card.name)}">`
    : `<div class="slot-media no-image" style="border-radius:8px;">sin imagen</div>`;

  els.detailBody.innerHTML = `
    <div class="card-detail">
      ${img}
      <div>
        <div class="slot-meta">${escapeHtml(card.set || '')} ${card.number ? '· ' + escapeHtml(card.number) : ''}</div>
        <div class="pill-row">
          <span class="slot-condition">${escapeHtml(card.productType || 'Carta individual')}</span>
          <span class="slot-condition">${escapeHtml(card.language || 'Español')}</span>
          <span class="slot-condition">${escapeHtml(card.condition)}</span>
        </div>
        <p class="slot-price" style="font-size:1.3rem;margin-top:10px;">${money(card.price)}</p>
        <p class="desc">${escapeHtml(card.description || 'Sin descripción adicional.')}</p>
        <button class="btn-primary" style="margin-top:14px;width:100%;" data-add="${card.id}">Añadir al carrito</button>
      </div>
    </div>
  `;
  els.detailBody.querySelector('[data-add]').addEventListener('click', () => {
    addToCart(card);
    closeDetail();
  });

  els.detailOverlay.classList.add('open');
  els.detailModal.classList.add('open');
}

function closeDetail() {
  els.detailOverlay.classList.remove('open');
  els.detailModal.classList.remove('open');
}

els.closeDetail.addEventListener('click', closeDetail);
els.detailOverlay.addEventListener('click', closeDetail);

// ---------- Carrito (drawer) ----------

function renderCart() {
  const cart = getCart();
  els.cartCount.textContent = cart.length;

  if (cart.length === 0) {
    els.cartItems.innerHTML = `<p style="color:var(--muted);font-size:0.9rem;">Tu carrito está vacío.</p>`;
    els.goCheckout.disabled = true;
  } else {
    els.cartItems.innerHTML = cart
      .map(
        (item) => `
      <div class="cart-item">
        ${item.image ? `<img src="${item.image}" alt="">` : ''}
        <div class="cart-item-info">
          <div class="name">${escapeHtml(item.name)}</div>
          <div class="price">${money(item.price)}</div>
        </div>
        <button class="remove-item" data-remove="${item.id}" aria-label="Quitar">✕</button>
      </div>
    `
      )
      .join('');

    els.cartItems.querySelectorAll('[data-remove]').forEach((btn) => {
      btn.addEventListener('click', () => removeFromCart(btn.dataset.remove));
    });
    els.goCheckout.disabled = false;
  }

  const total = cart.reduce((sum, i) => sum + i.price, 0);
  els.cartTotal.textContent = money(total);
}

function openCart() {
  els.cartOverlay.classList.add('open');
  els.cartDrawer.classList.add('open');
}
function closeCart() {
  els.cartOverlay.classList.remove('open');
  els.cartDrawer.classList.remove('open');
}

els.openCart.addEventListener('click', openCart);
els.closeCart.addEventListener('click', closeCart);
els.cartOverlay.addEventListener('click', closeCart);

// ---------- Checkout ----------

let selectedMethod = 'bizum';

function openCheckout() {
  closeCart();
  selectedMethod = 'bizum';
  renderCheckoutForm();
  els.checkoutOverlay.classList.add('open');
  els.checkoutModal.classList.add('open');
}

function closeCheckout() {
  els.checkoutOverlay.classList.remove('open');
  els.checkoutModal.classList.remove('open');
}

els.goCheckout.addEventListener('click', openCheckout);
els.closeCheckout.addEventListener('click', closeCheckout);
els.checkoutOverlay.addEventListener('click', closeCheckout);

function renderCheckoutForm(errorMsg) {
  const cart = getCart();
  const total = cart.reduce((sum, i) => sum + i.price, 0);

  els.checkoutBody.innerHTML = `
    ${errorMsg ? `<div class="notice error">${escapeHtml(errorMsg)}</div>` : ''}
    <div class="field">
      <label for="buyerName">Tu nombre</label>
      <input id="buyerName" type="text" placeholder="Nombre y apellidos" />
    </div>
    <div class="field">
      <label for="buyerContact">Email o teléfono de contacto</label>
      <input id="buyerContact" type="text" placeholder="para avisarte cuando confirme tu compra" />
    </div>

    <div class="payment-tabs">
      <button type="button" class="payment-tab ${selectedMethod === 'bizum' ? 'active' : ''}" data-method="bizum">Bizum</button>
      <button type="button" class="payment-tab ${selectedMethod === 'paypal' ? 'active' : ''}" data-method="paypal">PayPal</button>
    </div>

    <div class="total-row" style="margin-bottom:16px;">
      <span>Total a pagar</span>
      <span class="amount">${money(total)}</span>
    </div>

    <div id="paymentArea"></div>
  `;

  els.checkoutBody.querySelectorAll('.payment-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedMethod = btn.dataset.method;
      renderCheckoutForm();
    });
  });

  const area = document.getElementById('paymentArea');
  if (selectedMethod === 'bizum') {
    area.innerHTML = `
      <p style="color:var(--muted);font-size:0.85rem;">
        Al confirmar se reservan tus cartas. Te aparecerá el número para hacer el Bizum;
        en cuanto el vendedor vea el ingreso, marcará el pedido como pagado.
      </p>
      <button class="btn-primary" id="submitCheckout" style="width:100%;margin-top:10px;">Reservar y ver datos de Bizum</button>
    `;
  } else {
    area.innerHTML = `
      <p style="color:var(--muted);font-size:0.85rem;">
        Se reservan tus cartas durante unos minutos mientras completas el pago con PayPal.
      </p>
      <button class="btn-primary" id="submitCheckout" style="width:100%;margin-top:10px;">Reservar y pagar con PayPal</button>
    `;
  }

  document.getElementById('submitCheckout').addEventListener('click', submitCheckout);
}

async function submitCheckout() {
  const buyerName = document.getElementById('buyerName').value.trim();
  const buyerContact = document.getElementById('buyerContact').value.trim();
  const cart = getCart();

  if (!buyerName || !buyerContact) {
    renderCheckoutForm('Indica tu nombre y un contacto para continuar.');
    return;
  }
  if (cart.length === 0) {
    renderCheckoutForm('Tu carrito está vacío.');
    return;
  }

  const submitBtn = document.getElementById('submitCheckout');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Reservando...';

  try {
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cardIds: cart.map((c) => c.id),
        buyerName,
        buyerContact,
        method: selectedMethod
      })
    });
    const order = await res.json();

    if (!res.ok) {
      renderCheckoutForm(order.error || 'No se pudo crear el pedido.');
      return;
    }

    clearCart();

    if (order.method === 'bizum') {
      showBizumInstructions(order);
    } else {
      showPaypalFlow(order);
    }

    loadCards();
  } catch (err) {
    renderCheckoutForm('No se pudo conectar con el servidor. Inténtalo de nuevo.');
  }
}

function showBizumInstructions(order) {
  const expires = new Date(order.expiresAt);
  els.checkoutBody.innerHTML = `
    <div class="notice success">Cartas reservadas para ti. Completa el Bizum antes de que expire la reserva.</div>
    <dl class="bizum-instructions">
      <dt>Enviar Bizum a</dt>
      <dd>${escapeHtml(order.bizum.phone || 'Pendiente de configurar')}</dd>
      <dt>A nombre de</dt>
      <dd>${escapeHtml(order.bizum.holder || '')}</dd>
      <dt>Concepto (importante)</dt>
      <dd>${order.bizum.concept}</dd>
      <dt>Importe</dt>
      <dd>${money(order.total)}</dd>
      <dt>Reserva válida hasta</dt>
      <dd>${expires.toLocaleString('es-ES')}</dd>
    </dl>
    <p style="color:var(--muted);font-size:0.85rem;margin-top:14px;">
      En cuanto el vendedor reciba el Bizum y lo confirme, te contactará para el envío.
      Si la reserva expira sin recibir el pago, las cartas vuelven a estar disponibles.
    </p>
    <button class="btn-secondary" style="width:100%;margin-top:10px;" onclick="closeCheckout()">Entendido</button>
  `;
}

function showPaypalFlow(order) {
  els.checkoutBody.innerHTML = `
    <div class="notice success">Cartas reservadas. Completa el pago con PayPal para confirmar tu compra.</div>
    <div id="paypal-button-container" style="margin-top:14px;"></div>
    <div id="paypalStatus" style="margin-top:10px;font-size:0.85rem;color:var(--muted);"></div>
  `;

  loadPaypalButtons(order);
}

async function loadPaypalButtons(order) {
  const statusEl = document.getElementById('paypalStatus');
  try {
    const cfgRes = await fetch('/api/paypal/config');
    const cfg = await cfgRes.json();

    if (!cfg.clientId) {
      statusEl.textContent = 'PayPal todavía no está configurado en este servidor (falta PAYPAL_CLIENT_ID en .env).';
      return;
    }

    if (!window.paypal) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(cfg.clientId)}&currency=${cfg.currency}`;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }

    window.paypal
      .Buttons({
        createOrder: async () => {
          const res = await fetch('/api/paypal/create-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId: order.id })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'No se pudo iniciar el pago.');
          return data.paypalOrderId;
        },
        onApprove: async () => {
          statusEl.textContent = 'Confirmando el pago...';
          const res = await fetch('/api/paypal/capture-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId: order.id })
          });
          const data = await res.json();
          if (data.status === 'paid') {
            els.checkoutBody.innerHTML = `<div class="notice success">¡Pago confirmado! Tu compra ha quedado registrada.</div>
              <button class="btn-secondary" style="width:100%;margin-top:10px;" onclick="closeCheckout()">Cerrar</button>`;
            loadCards();
          } else {
            statusEl.textContent = 'El pago no se pudo confirmar. Contacta con el vendedor.';
          }
        },
        onError: () => {
          statusEl.textContent = 'Ha ocurrido un error con PayPal. Inténtalo de nuevo.';
        }
      })
      .render('#paypal-button-container');
  } catch (err) {
    statusEl.textContent = 'No se pudo cargar PayPal ahora mismo.';
  }
}

// ---------- Init ----------

renderCart();
loadCards();
