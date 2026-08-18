const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

const { transact, readData } = require('../db/store');
const requireAdmin = require('../middleware/requireAdmin');
const { uploadFilesIfConfigured } = require('../utils/imageStorage');

const router = express.Router();

const UPLOADS_DIR = path.join(__dirname, '..', 'public', 'uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${crypto.randomUUID()}${ext}`);
  }
});

function fileFilter(req, file, cb) {
  const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) return cb(null, true);
  cb(new Error('Formato de imagen no admitido. Usa jpg, png o webp.'));
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 8 * 1024 * 1024, files: 6 }
});

// Solo devolvemos al publico los datos que un comprador necesita ver.
function toPublicCard(card) {
  return {
    id: card.id,
    name: card.name,
    set: card.set,
    number: card.number,
    condition: card.condition,
    productType: card.productType || 'Carta individual',
    language: card.language || 'Español',
    price: card.price,
    description: card.description,
    images: card.images,
    status: card.status,
    views: card.views || 0
  };
}

// ---------- Rutas publicas ----------

router.get('/', async (req, res) => {
  const data = await readData();
  const cards = data.cards
    .filter((c) => c.status === 'available')
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(toPublicCard);
  res.json(cards);
});

router.get('/:id', async (req, res) => {
  const data = await readData();
  const card = data.cards.find((c) => c.id === req.params.id);
  if (!card || card.status === 'sold') {
    return res.status(404).json({ error: 'Esa carta no existe o ya no esta disponible.' });
  }
  res.json(toPublicCard(card));
});

// Suma una visita cuando alguien abre el detalle de una carta (para poder ordenar por "mas vistas").
router.post('/:id/view', async (req, res) => {
  await transact((data) => {
    const card = data.cards.find((c) => c.id === req.params.id);
    if (card) card.views = (card.views || 0) + 1;
  });
  res.json({ ok: true });
});

// ---------- Rutas de administracion ----------

router.get('/admin/all', requireAdmin, async (req, res) => {
  const data = await readData();
  const cards = [...data.cards].sort((a, b) => b.createdAt - a.createdAt);
  res.json(cards);
});

router.post('/admin', requireAdmin, upload.array('images', 6), async (req, res) => {
  try {
    const {
      name,
      set,
      number,
      condition,
      productType,
      language,
      price,
      description,
      pokemonTcgId,
      pokemonTcgName,
      autoPriceSync,
      priceMarginPercent
    } = req.body;

    if (!name || !price) {
      return res.status(400).json({ error: 'El nombre y el precio son obligatorios.' });
    }

    const priceNumber = Number(price);
    if (Number.isNaN(priceNumber) || priceNumber <= 0) {
      return res.status(400).json({ error: 'El precio tiene que ser un numero mayor que 0.' });
    }

    const images = await uploadFilesIfConfigured(req.files);

    const card = await transact((data) => {
      const newCard = {
        id: crypto.randomUUID(),
        name,
        set: set || '',
        number: number || '',
        condition: condition || 'Buen estado',
        productType: productType || 'Carta individual',
        language: language || 'Español',
        price: priceNumber,
        description: description || '',
        images,
        status: 'available',
        createdAt: Date.now(),
        soldAt: null,
        views: 0,
        pokemonTcgId: pokemonTcgId || '',
        pokemonTcgName: pokemonTcgName || '',
        autoPriceSync: autoPriceSync === 'true' || autoPriceSync === true,
        priceMarginPercent: Number(priceMarginPercent) || 0,
        pendingPrice: null,
        pendingPriceMarket: null,
        pendingPriceAt: null,
        lastPriceSyncAt: null
      };
      data.cards.push(newCard);
      return newCard;
    });

    res.status(201).json(card);
  } catch (err) {
    res.status(400).json({ error: err.message || 'No se pudo crear la carta.' });
  }
});

router.put('/admin/:id', requireAdmin, upload.array('images', 6), async (req, res) => {
  try {
    const {
      name,
      set,
      number,
      condition,
      productType,
      language,
      price,
      description,
      removeImages,
      pokemonTcgId,
      pokemonTcgName,
      autoPriceSync,
      priceMarginPercent
    } = req.body;
    const removeSet = new Set(
      removeImages ? (Array.isArray(removeImages) ? removeImages : [removeImages]) : []
    );
    const newImages = await uploadFilesIfConfigured(req.files);

    const updated = await transact((data) => {
      const card = data.cards.find((c) => c.id === req.params.id);
      if (!card) return null;

      if (name !== undefined) card.name = name;
      if (set !== undefined) card.set = set;
      if (number !== undefined) card.number = number;
      if (condition !== undefined) card.condition = condition;
      if (productType !== undefined) card.productType = productType;
      if (language !== undefined) card.language = language;
      if (pokemonTcgId !== undefined) card.pokemonTcgId = pokemonTcgId;
      if (pokemonTcgName !== undefined) card.pokemonTcgName = pokemonTcgName;
      if (autoPriceSync !== undefined) card.autoPriceSync = autoPriceSync === 'true' || autoPriceSync === true;
      if (priceMarginPercent !== undefined) card.priceMarginPercent = Number(priceMarginPercent) || 0;
      if (description !== undefined) card.description = description;
      if (price !== undefined) {
        const priceNumber = Number(price);
        if (!Number.isNaN(priceNumber) && priceNumber > 0) card.price = priceNumber;
      }

      if (removeSet.size) {
        card.images = card.images.filter((img) => !removeSet.has(img));
      }
      card.images = [...card.images, ...newImages];

      return card;
    });

    if (!updated) return res.status(404).json({ error: 'Carta no encontrada.' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message || 'No se pudo actualizar la carta.' });
  }
});

router.delete('/admin/:id', requireAdmin, async (req, res) => {
  const removed = await transact((data) => {
    const idx = data.cards.findIndex((c) => c.id === req.params.id);
    if (idx === -1) return null;
    const [card] = data.cards.splice(idx, 1);
    return card;
  });

  if (!removed) return res.status(404).json({ error: 'Carta no encontrada.' });

  removed.images.forEach((imgPath) => {
    if (imgPath.startsWith('http')) return; // vive en Cloudinary, no en este disco
    const filePath = path.join(__dirname, '..', 'public', imgPath);
    fs.unlink(filePath, () => {});
  });

  res.json({ ok: true });
});

module.exports = router;
