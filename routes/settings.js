const express = require('express');

const { transact, readData } = require('../db/store');
const { getSettings } = require('../utils/settings');
const requireAdmin = require('../middleware/requireAdmin');

const router = express.Router();

router.get('/', requireAdmin, async (req, res) => {
  res.json(getSettings(await readData()));
});

router.put('/', requireAdmin, async (req, res) => {
  const {
    bizumPhone,
    bizumHolderName,
    bizumReserveMinutes,
    paypalMode,
    paypalClientId,
    paypalSecret,
    cloudinaryCloudName,
    cloudinaryApiKey,
    cloudinaryApiSecret
  } = req.body || {};

  const updated = await transact((data) => {
    const current = getSettings(data);

    const minutes = Number(bizumReserveMinutes);

    data.settings = {
      bizumPhone: bizumPhone !== undefined ? String(bizumPhone).trim() : current.bizumPhone,
      bizumHolderName:
        bizumHolderName !== undefined ? String(bizumHolderName).trim() : current.bizumHolderName,
      bizumReserveMinutes: Number.isFinite(minutes) && minutes > 0 ? minutes : current.bizumReserveMinutes,
      paypalMode: paypalMode === 'live' ? 'live' : 'sandbox',
      paypalClientId:
        paypalClientId !== undefined ? String(paypalClientId).trim() : current.paypalClientId,
      paypalSecret: paypalSecret !== undefined ? String(paypalSecret).trim() : current.paypalSecret,
      cloudinaryCloudName:
        cloudinaryCloudName !== undefined
          ? String(cloudinaryCloudName).trim()
          : current.cloudinaryCloudName,
      cloudinaryApiKey:
        cloudinaryApiKey !== undefined ? String(cloudinaryApiKey).trim() : current.cloudinaryApiKey,
      cloudinaryApiSecret:
        cloudinaryApiSecret !== undefined
          ? String(cloudinaryApiSecret).trim()
          : current.cloudinaryApiSecret
    };

    return data.settings;
  });

  res.json(updated);
});

module.exports = router;
