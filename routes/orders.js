const express = require('express');
const crypto = require('crypto');

const { transact, readData } = require('../db/store');
const { getSettings } = require('../utils/settings');

const router = express.Router();

const PAYPAL_RESERVE_MS = 20 * 60 * 1000; // 20 min para completar el pago con PayPal

function orderPublicView(order, settings) {
  return {
    id: order.id,
    reference: order.reference,
    items: order.items,
    total: order.total,
    method: order.method,
    status: order.status,
    expiresAt: order.expiresAt,
    bizum: order.method === 'bizum'
      ? {
          phone: settings.bizumPhone,
          holder: settings.bizumHolderName,
          concept: order.reference
        }
      : undefined
  };
}

// Crea el pedido y reserva las cartas para que nadie mas las compre mientras se paga.
router.post('/checkout', async (req, res) => {
  const { cardIds, buyerName, buyerContact, method } = req.body || {};

  if (!Array.isArray(cardIds) || cardIds.length === 0) {
    return res.status(400).json({ error: 'El carrito esta vacio.' });
  }
  if (!buyerName || !buyerContact) {
    return res.status(400).json({ error: 'Indica tu nombre y un contacto (email o telefono).' });
  }
  if (String(buyerName).length > 120 || String(buyerContact).length > 200) {
    return res.status(400).json({ error: 'El nombre o el contacto son demasiado largos.' });
  }
  if (!['bizum', 'paypal'].includes(method)) {
    return res.status(400).json({ error: 'Metodo de pago no valido.' });
  }

  // Quita duplicados y pone un tope: evita que un carrito manipulado reserve
  // el catalogo entero de golpe sin llegar a pagar nunca.
  const uniqueCardIds = [...new Set(cardIds)].slice(0, 30);

  try {
    const { order, settings } = await transact((data) => {
      const settings = getSettings(data);

      if (method === 'bizum' && !settings.bizumPhone) {
        throw new Error('El vendedor todavia no ha configurado Bizum. Prueba con PayPal o vuelve mas tarde.');
      }
      if (method === 'paypal' && (!settings.paypalClientId || !settings.paypalSecret)) {
        throw new Error('El vendedor todavia no ha configurado PayPal. Prueba con Bizum o vuelve mas tarde.');
      }

      const cards = uniqueCardIds.map((id) => data.cards.find((c) => c.id === id));
      const missing = cards.some((c) => !c || c.status !== 'available');
      if (missing) {
        throw new Error('Alguna carta del carrito ya no esta disponible. Actualiza la pagina.');
      }

      const now = Date.now();
      const expiresAt =
        now + (method === 'bizum' ? settings.bizumReserveMinutes * 60 * 1000 : PAYPAL_RESERVE_MS);
      const orderId = crypto.randomUUID();
      const reference = orderId.slice(0, 8).toUpperCase();

      cards.forEach((card) => {
        card.status = 'reserved';
        card.reservedOrderId = orderId;
      });

      const newOrder = {
        id: orderId,
        reference,
        items: cards.map((c) => ({ cardId: c.id, name: c.name, price: c.price })),
        total: cards.reduce((sum, c) => sum + c.price, 0),
        buyerName,
        buyerContact,
        method,
        status: 'pending',
        paypalOrderId: null,
        createdAt: now,
        expiresAt
      };

      data.orders.push(newOrder);
      return { order: newOrder, settings };
    });

    res.status(201).json(orderPublicView(order, settings));
  } catch (err) {
    res.status(409).json({ error: err.message || 'No se pudo crear el pedido.' });
  }
});

router.get('/checkout/:id', async (req, res) => {
  const data = await readData();
  const order = data.orders.find((o) => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'Pedido no encontrado.' });
  res.json(orderPublicView(order, getSettings(data)));
});

module.exports = router;
