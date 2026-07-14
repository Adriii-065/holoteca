// Sube las fotos de las cartas a Cloudinary si el admin ha guardado sus
// credenciales en Ajustes; si no, se quedan tal cual en public/uploads
// (el comportamiento de siempre, sin ningun servicio externo).
//
// Esto existe porque, si algun dia despliegas en un plan gratis (Render,
// por ejemplo), el disco local se borra en cada reinicio: las fotos que
// vivan solo en public/uploads desapareceran. Subirlas a Cloudinary las deja
// a salvo, fuera del disco de tu servidor.

const fs = require('fs');
const path = require('path');
const { readData } = require('../db/store');
const { getSettings } = require('./settings');

async function uploadFilesIfConfigured(files) {
  if (!files || files.length === 0) return [];

  const settings = getSettings(await readData());
  const cloudinaryReady =
    settings.cloudinaryCloudName && settings.cloudinaryApiKey && settings.cloudinaryApiSecret;

  if (!cloudinaryReady) {
    // Sin Cloudinary configurado: se quedan como archivos locales, tal cual.
    return files.map((f) => `/uploads/${f.filename}`);
  }

  const cloudinary = require('cloudinary').v2;
  cloudinary.config({
    cloud_name: settings.cloudinaryCloudName,
    api_key: settings.cloudinaryApiKey,
    api_secret: settings.cloudinaryApiSecret
  });

  const urls = [];
  for (const file of files) {
    try {
      const result = await cloudinary.uploader.upload(file.path, { folder: 'holoteca' });
      urls.push(result.secure_url);
    } catch (err) {
      // Si Cloudinary falla (credenciales mal puestas, sin internet, etc.)
      // no perdemos la foto: se queda guardada en local en su lugar.
      console.error('No se pudo subir a Cloudinary, se guarda en local:', err.message);
      urls.push(`/uploads/${file.filename}`);
      continue;
    }
    // Ya esta en Cloudinary: el archivo temporal local ya no hace falta.
    fs.unlink(path.join(file.destination, file.filename), () => {});
  }

  return urls;
}

module.exports = { uploadFilesIfConfigured };
