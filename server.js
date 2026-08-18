require('dotenv').config();

const express = require('express');
const session = require('express-session');
const path = require('path');

const { transact } = require('./db/store');
const authRoutes = require('./routes/auth');
const cardRoutes = require('./routes/cards');
const orderRoutes = require('./routes/orders');
const adminOrderRoutes = require('./routes/adminOrders');
const settingsRoutes = require('./routes/settings');
const priceSyncRoutes = require('./routes/priceSync');
const paypalRoutes = require('./routes/paypal');
const { syncAllPrices } = require('./utils/priceSyncEngine');

const app = express();
const PORT = process.env.PORT || 3000;

// Necesario en cuanto la web vive detras de un proxy (Render, Railway, etc.)
app.set('trust proxy', 1);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'cambia-esto-en-tu-.env',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 8 // 8 horas
    }
  })
);

app.use('/api/admin', authRoutes);
app.use('/api/cards', cardRoutes);
app.use('/api', orderRoutes);
app.use('/api/admin/orders', adminOrderRoutes);
app.use('/api/admin/settings', settingsRoutes);
app.use('/api/admin/prices', priceSyncRoutes);
app.use('/api/paypal', paypalRoutes);

app.use(express.static(path.join(__dirname, 'public')));

// Cualquier ruta desconocida bajo /admin sirve el panel (para poder recargar /admin en el navegador)
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Libera automaticamente las cartas cuya reserva (Bizum o PayPal a medias) ha caducado.
async function releaseExpiredReservations() {
  const now = Date.now();
  await transact((data) => {
    data.orders.forEach((order) => {
      if (order.status === 'pending' && order.expiresAt < now) {
        order.status = 'expired';
        order.items.forEach((item) => {
          const card = data.cards.find((c) => c.id === item.cardId);
          if (card && card.status === 'reserved' && card.reservedOrderId === order.id) {
            card.status = 'available';
            card.reservedOrderId = null;
          }
        });
      }
    });
  });
}

setInterval(() => {
  releaseExpiredReservations().catch((err) => {
    console.error('Error liberando reservas caducadas:', err);
  });
}, 60 * 1000);

// Sincroniza precios con Cardmarket una vez al dia para las cartas que lo tengan activado.
setInterval(() => {
  syncAllPrices().catch((err) => {
    console.error('Error sincronizando precios:', err);
  });
}, 24 * 60 * 60 * 1000);

app.listen(PORT, () => {
  console.log(`\nHoloteca esta lista.`);
  console.log(`Tienda:  http://localhost:${PORT}`);
  console.log(`Admin:   http://localhost:${PORT}/admin\n`);
});
