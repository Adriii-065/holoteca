const express = require('express');

const { transact, readData } = require('../db/store');
const { getSettings } = require('../utils/settings');
const { searchCards } = require('../utils/pokemonTcgApi');
const { syncAllPrices } = require('../utils/priceSyncEngine');
const requireAdmin = require('../middleware/requireAdmin');

const router = express.Router();

// Busca en pokemontcg.io para que el admin pueda vincular una carta suya con la ficha real.
router.get('/search', requireAdmin, async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json([]);

  try {
    const settings = getSettings(await readData());
    const results = await searchCards(q, settings.pokemonTcgApiKey);
    res.json(results);
  } catch (err) {
    res.status(400).json({ error: err.message || 'No se pudo buscar.' });
  }
});

// Lanza una pasada de sincronizacion para todas las cartas con auto-sync activado.
router.post('/run', requireAdmin, async (req, res) => {
  try {
    const summary = await syncAllPrices();
    res.json(summary);
  } catch (err) {
    res.status(400).json({ error: err.message || 'No se pudo sincronizar los precios.' });
  }
});

// Devuelve las cartas con un cambio de precio pendiente de revisar.
router.get('/pending', requireAdmin, async (req, res) => {
  const data = await readData();
  const pending = data.cards
    .filter((c) => c.pendingPrice != null)
    .map((c) => ({
      id: c.id,
      name: c.name,
      set: c.set,
      number: c.number,
      currentPrice: c.price,
      pendingPrice: c.pendingPrice,
      pendingPriceMarket: c.pendingPriceMarket,
      pendingPriceAt: c.pendingPriceAt
    }));
  res.json(pending);
});

router.post('/:id/approve', requireAdmin, async (req, res) => {
  const updated = await transact((data) => {
    const card = data.cards.find((c) => c.id === req.params.id);
    if (!card || card.pendingPrice == null) return null;
    card.price = card.pendingPrice;
    card.pendingPrice = null;
    card.pendingPriceMarket = null;
    card.pendingPriceAt = null;
    return card;
  });

  if (!updated) return res.status(404).json({ error: 'No hay ningun cambio pendiente para esa carta.' });
  res.json(updated);
});

router.post('/:id/dismiss', requireAdmin, async (req, res) => {
  const updated = await transact((data) => {
    const card = data.cards.find((c) => c.id === req.params.id);
    if (!card) return null;
    card.pendingPrice = null;
    card.pendingPriceMarket = null;
    card.pendingPriceAt = null;
    return card;
  });

  if (!updated) return res.status(404).json({ error: 'Carta no encontrada.' });
  res.json(updated);
});

module.exports = router;
