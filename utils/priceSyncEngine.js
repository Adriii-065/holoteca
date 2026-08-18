const { transact, readData } = require('../db/store');
const { getSettings } = require('./settings');
const { getCardPrice } = require('./pokemonTcgApi');

// Redondea siempre hacia arriba, al euro entero (sin centimos).
function roundUpToEuro(value) {
  return Math.ceil(value);
}

async function syncAllPrices() {
  const data = await readData();
  const settings = getSettings(data);

  const candidates = data.cards.filter(
    (c) => c.autoPriceSync && c.pokemonTcgId && c.status !== 'sold'
  );

  const summary = { updated: [], pending: [], failed: [], checked: candidates.length };

  for (const card of candidates) {
    try {
      const marketPrice = await getCardPrice(card.pokemonTcgId, settings.pokemonTcgApiKey);
      const margin = Number(card.priceMarginPercent) || 0;
      const newPrice = roundUpToEuro(marketPrice * (1 + margin / 100));

      const changePercent =
        card.price > 0 ? (Math.abs(newPrice - card.price) / card.price) * 100 : 100;
      const threshold = Number(settings.priceAutoThresholdPercent) || 15;
      const autoApply = changePercent <= threshold;

      await transact((d) => {
        const target = d.cards.find((x) => x.id === card.id);
        if (!target) return;
        target.lastPriceSyncAt = Date.now();

        if (autoApply) {
          target.price = newPrice;
          target.pendingPrice = null;
          target.pendingPriceMarket = null;
          target.pendingPriceAt = null;
        } else {
          target.pendingPrice = newPrice;
          target.pendingPriceMarket = marketPrice;
          target.pendingPriceAt = Date.now();
        }
      });

      if (autoApply) {
        summary.updated.push({ id: card.id, name: card.name, newPrice });
      } else {
        summary.pending.push({ id: card.id, name: card.name, oldPrice: card.price, newPrice });
      }
    } catch (err) {
      summary.failed.push({ id: card.id, name: card.name, error: err.message });
    }
  }

  return summary;
}

module.exports = { syncAllPrices, roundUpToEuro };
