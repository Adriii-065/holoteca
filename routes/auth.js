const express = require('express');
const { verifyPassword, hashPassword } = require('../utils/password');

const router = express.Router();

// Hash "señuelo" para comparar contra el si el usuario no existe, y que
// responder tarde lo mismo tanto si el usuario esta bien como si esta mal
// (si no, el tiempo de respuesta delataria si el usuario era correcto).
const DECOY_HASH = hashPassword(require('crypto').randomBytes(16).toString('hex'));

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
  // Siempre se ejecuta la comparacion de contrasena, exista o no el usuario,
  // para que el tiempo de respuesta no delate si el usuario era correcto.
  const passOk = verifyPassword(password, userOk ? expectedHash : DECOY_HASH);

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
