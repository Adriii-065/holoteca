const express = require('express');
const { readData, transact } = require('../db/store');
const { getSettings } = require('../utils/settings');

const router = express.Router();

function paypalBaseUrl(mode) {
  return mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
}

async function getAccessToken(settings) {
  if (!settings.paypalClientId || !settings.paypalSecret) {
    throw new Error(
      'PayPal no esta configurado todavia. Entra en el panel de admin, pestana "Ajustes de cobro", y guarda tu Client ID y Secret.'
    );
  }

  const basicAuth = Buffer.from(`${settings.paypalClientId}:${settings.paypalSecret}`).toString('base64');

  const resp = await fetch(`${paypalBaseUrl(settings.paypalMode)}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });

  if (!resp.ok) {
    throw new Error('PayPal rechazo las credenciales guardadas en Ajustes. Revisa el Client ID y el Secret.');
  }

  const data = await resp.json();
  return data.access_token;
}

// El frontend necesita el client id (publico, no el secreto) para cargar el boton de PayPal.
router.get('/config', async (req, res) => {
  const settings = getSettings(await readData());
  res.json({
    clientId: settings.paypalClientId || null,
    currency: 'EUR'
  });
});

router.post('/create-order', async (req, res) => {
  const { orderId } = req.body || {};

  try {
    const data = await readData();
    const settings = getSettings(data);
    const localOrder = data.orders.find((o) => o.id === orderId);
    if (!localOrder || localOrder.status !== 'pending' || localOrder.method !== 'paypal') {
      return res.status(404).json({ error: 'Pedido no encontrado o no valido para PayPal.' });
    }

    const accessToken = await getAccessToken(settings);

    const resp = await fetch(`${paypalBaseUrl(settings.paypalMode)}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: localOrder.id,
            description: `Holoteca - pedido ${localOrder.reference}`,
            amount: {
              currency_code: 'EUR',
              value: localOrder.total.toFixed(2)
            }
          }
        ]
      })
    });

    const ppOrder = await resp.json();
    if (!resp.ok) {
      throw new Error(ppOrder.message || 'PayPal no pudo crear el pedido.');
    }

    await transact((d) => {
      const order = d.orders.find((o) => o.id === orderId);
      if (order) order.paypalOrderId = ppOrder.id;
    });

    res.json({ paypalOrderId: ppOrder.id });
  } catch (err) {
    res.status(400).json({ error: err.message || 'No se pudo iniciar el pago con PayPal.' });
  }
});

router.post('/capture-order', async (req, res) => {
  const { orderId } = req.body || {};

  try {
    const data = await readData();
    const settings = getSettings(data);
    const localOrder = data.orders.find((o) => o.id === orderId);
    if (!localOrder || !localOrder.paypalOrderId) {
      return res.status(404).json({ error: 'Pedido no encontrado.' });
    }
    if (localOrder.status === 'paid') {
      return res.json({ status: 'paid' });
    }

    const accessToken = await getAccessToken(settings);

    const resp = await fetch(
      `${paypalBaseUrl(settings.paypalMode)}/v2/checkout/orders/${localOrder.paypalOrderId}/capture`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const capture = await resp.json();
    if (!resp.ok) {
      throw new Error(capture.message || 'PayPal no pudo confirmar el pago.');
    }

    const captureStatus = capture.status;

    if (captureStatus === 'COMPLETED') {
      await transact((d) => {
        const order = d.orders.find((o) => o.id === orderId);
        if (!order || order.status === 'paid') return;
        order.status = 'paid';
        order.paidAt = Date.now();
        order.items.forEach((item) => {
          const card = d.cards.find((c) => c.id === item.cardId);
          if (card) {
            card.status = 'sold';
            card.soldAt = Date.now();
          }
        });
      });
      return res.json({ status: 'paid' });
    }

    res.json({ status: captureStatus });
  } catch (err) {
    res.status(400).json({ error: err.message || 'No se pudo confirmar el pago con PayPal.' });
  }
});

module.exports = router;
