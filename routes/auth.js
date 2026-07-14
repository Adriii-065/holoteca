const express = require('express');
const { verifyPassword } = require('../utils/password');

const router = express.Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ error: 'Falta usuario o contrasena.' });
  }

  const expectedUser = process.env.ADMIN_USERNAME;
  const expectedHash = process.env.ADMIN_PASSWORD_HASH;

  if (!expectedUser || !expectedHash) {
    return res.status(500).json({
      error: 'El admin todavia no esta configurado. Revisa el archivo .env (ADMIN_USERNAME y ADMIN_PASSWORD_HASH).'
    });
  }

  const userOk = username === expectedUser;
  const passOk = userOk && verifyPassword(password, expectedHash);

  if (!userOk || !passOk) {
    return res.status(401).json({ error: 'Usuario o contrasena incorrectos.' });
  }

  req.session.isAdmin = true;
  req.session.username = username;
  return res.json({ ok: true, username });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

router.get('/session', (req, res) => {
  res.json({ isAdmin: !!(req.session && req.session.isAdmin) });
});

module.exports = router;
