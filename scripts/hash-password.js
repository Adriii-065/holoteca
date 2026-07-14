// Genera el hash que debes pegar en ADMIN_PASSWORD_HASH dentro de .env
// Uso:  npm run hash-password -- "tu-contrasena-aqui"

const { hashPassword } = require('../utils/password');

const password = process.argv[2];

if (!password) {
  console.log('\nUso: npm run hash-password -- "tu-contrasena-aqui"\n');
  process.exit(1);
}

console.log('\nCopia esta linea entera dentro de tu archivo .env:\n');
console.log(`ADMIN_PASSWORD_HASH=${hashPassword(password)}\n`);
