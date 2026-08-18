// Cliente sencillo para la API publica y gratuita de pokemontcg.io.
// Se usa solo para: buscar una carta por nombre (para vincularla) y
// consultar su precio de mercado de Cardmarket (en euros).

const BASE_URL = 'https://api.pokemontcg.io/v2';

function authHeaders(apiKey) {
  return apiKey ? { 'X-Api-Key': apiKey } : {};
}

function extractMarketPrice(card) {
  const prices = card && card.cardmarket && card.cardmarket.prices;
  if (!prices) return null;
  const price = prices.trendPrice ?? prices.averageSellPrice ?? prices.lowPrice;
  return typeof price === 'number' ? price : null;
}

function toSearchResult(card) {
  return {
    id: card.id,
    name: card.name,
    setName: card.set ? card.set.name : '',
    number: card.number,
    image: card.images ? card.images.small : null,
    marketPrice: extractMarketPrice(card)
  };
}

async function searchCards(query, apiKey) {
  const safeQuery = String(query).replace(/["*]/g, '').trim();
  if (!safeQuery) return [];

  const q = `name:${safeQuery}*`;
  const url = `${BASE_URL}/cards?q=${encodeURIComponent(q)}&pageSize=15&orderBy=name`;

  const resp = await fetch(url, { headers: authHeaders(apiKey) });
  if (!resp.ok) {
    throw new Error('No se pudo buscar en pokemontcg.io ahora mismo. Intentalo de nuevo en un momento.');
  }
  const body = await resp.json();
  return (body.data || []).map(toSearchResult);
}

async function getCardPrice(pokemonTcgId, apiKey) {
  const resp = await fetch(`${BASE_URL}/cards/${encodeURIComponent(pokemonTcgId)}`, {
    headers: authHeaders(apiKey)
  });
  if (!resp.ok) {
    throw new Error('No se pudo consultar esa carta en pokemontcg.io.');
  }
  const body = await resp.json();
  const marketPrice = extractMarketPrice(body.data);
  if (marketPrice === null) {
    throw new Error('Esa carta todavia no tiene precio de Cardmarket disponible.');
  }
  return marketPrice;
}

module.exports = { searchCards, getCardPrice };
