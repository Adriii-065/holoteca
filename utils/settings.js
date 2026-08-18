// Ajustes de cobro (Bizum y PayPal) que el propio admin gestiona desde el
// panel, en vez de tener que editar archivos. Se guardan en db/data.json.

const DEFAULT_SETTINGS = {
  bizumPhone: '',
  bizumHolderName: '',
  bizumReserveMinutes: 60,
  paypalMode: 'sandbox',
  paypalClientId: '',
  paypalSecret: '',
  cloudinaryCloudName: '',
  cloudinaryApiKey: '',
  cloudinaryApiSecret: '',
  pokemonTcgApiKey: '',
  priceAutoThresholdPercent: 15
};

function getSettings(data) {
  return { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
}

module.exports = { DEFAULT_SETTINGS, getSettings };
