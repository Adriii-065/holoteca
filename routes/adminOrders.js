const express = require('express');
const { transact, readData } = require('../db/store');
const requireAdmin = require('../middleware/requireAdmin');

const router = express.Router();

router.get('/', requireAdmin, async (req, res) => {
  const data = await readData();
  const orders = [...data.orders].sort((a, b) => b.createdAt - a.createdAt);
  res.json(orders);
});

// El vendedor pulsa esto cuando ve el Bizum en su banco.
router.post('/:id/confirm', requireAdmin, async (req, res) => {
  const updated = await transact((data) => {
    const order = data.orders.find((o) => o.id === req.params.id);
    if (!order || order.status !== 'pending') return null;

    order.status = 'paid';
    order.paidAt = Date.now();

    order.items.forEach((item) => {
      const card = data.cards.find((c) => c.id === item.cardId);
      if (card) {
        card.status = 'sold';
        card.soldAt = Date.now();
      }
    });

    return order;
  });

  if (!updated) return res.status(404).json({ error: 'Pedido no encontrado o ya resuelto.' });
  res.json(updated);
});

// El vendedor cancela una reserva (el comprador no ha pagado o se ha arrepentido).
router.post('/:id/cancel', requireAdmin, async (req, res) => {
  const updated = await transact((data) => {
    const order = data.orders.find((o) => o.id === req.params.id);
    if (!order || order.status !== 'pending') return null;

    order.status = 'cancelled';

    order.items.forEach((item) => {
      const card = data.cards.find((c) => c.id === item.cardId);
      if (card && card.status === 'reserved' && card.reservedOrderId === order.id) {
        card.status = 'available';
        card.reservedOrderId = null;
      }
    });

    return order;
  });

  if (!updated) return res.status(404).json({ error: 'Pedido no encontrado o ya resuelto.' });
  res.json(updated);
});

module.exports = router;
