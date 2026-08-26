require('dotenv').config();

const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
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

// Oculta que el servidor es Express (informacion que solo ayuda a atacantes).
app.disable('x-powered-by');

// Cabeceras de seguridad razonables por defecto (XSS, sniffing de tipos, clickjacking...).
// CSP desactivada: la web carga cosas de varios sitios (fuentes, PayPal, imagenes de
// Cloudinary/pokemontcg.io) y una CSP mal ajustada rompe la pagina en vez de protegerla.
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// La sesion NUNCA debe usar un secreto conocido/publico. Si no has puesto el tuyo
// en .env, generamos uno aleatorio en cada arranque (mejor que un valor fijo que
// cualquiera que vea este codigo tambien conoce), pero eso significa que las
// sesiones no sobreviven a un reinicio hasta que configures tu propio SESSION_SECRET.
let sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  sessionSecret = crypto.randomBytes(32).toString('hex');
  console.warn(
    '\n⚠️  No has configurado SESSION_SECRET en tu .env. Se ha generado uno aleatorio ' +
      'solo para este arranque (los admins tendran que volver a iniciar sesion cada ' +
      'vez que el servidor se reinicie). Pon tu propio SESSION_SECRET en .env cuanto antes.\n'
  );
}

// Si hay MongoDB configurado, guardamos las sesiones ahi (sobreviven a reinicios y
// no se pierden en cada "sueño" del plan gratis de Render). Sin Mongo, usa la
// memoria del proceso, que es suficiente para trabajar en local.
let sessionStore;
if (process.env.MONGODB_URI) {
  const MongoStore = require('connect-mongo');
  sessionStore = MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    dbName: process.env.MONGODB_DB || 'holoteca',
    collectionName: 'sessions',
    ttl: 60 * 60 * 8 // 8 horas, igual que la cookie
  });
}

app.use(
  session({
    secret: sessionSecret,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 8 // 8 horas
    }
  })
);

// Limite general para toda la API, como red de seguridad ante abusos que no
// hayamos previsto (ademas de los limites mas estrictos de login y checkout).
const generalApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api', generalApiLimiter);

// Limita los intentos de login para dificultar los ataques de fuerza bruta contra tu admin.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de inicio de sesion. Espera unos minutos y vuelve a intentarlo.' }
});
app.use('/api/admin/login', loginLimiter);

// Limita cuantos pedidos se pueden crear seguido, para que nadie pueda "secuestrar"
// todo el catalogo reservando todas las cartas sin llegar a pagar nunca.
const checkoutLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutos
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de compra seguidos. Espera unos minutos y vuelve a intentarlo.' }
});
app.use('/api/checkout', checkoutLimiter);

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
