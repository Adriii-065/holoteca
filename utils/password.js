// Hash de contrasenas usando scrypt, incluido en Node.js (no hace falta ninguna
// libreria externa). Formato guardado: "salt_en_hex:hash_en_hex".

const crypto = require('crypto');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!password || !stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  try {
    const hashBuffer = Buffer.from(hash, 'hex');
    const testBuffer = crypto.scryptSync(password, salt, 64);
    if (hashBuffer.length !== testBuffer.length) return false;
    return crypto.timingSafeEqual(hashBuffer, testBuffer);
  } catch {
    return false;
  }
}

module.exports = { hashPassword, verifyPassword };
