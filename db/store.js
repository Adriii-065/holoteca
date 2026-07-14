// Almacen de datos con dos "motores" intercambiables:
//  - Archivo local db/data.json (por defecto, cero configuracion).
//  - MongoDB Atlas, si defines MONGODB_URI en las variables de entorno
//    (recomendado al desplegar en un plan gratis con disco no persistente,
//    como el free tier de Render).
// El resto de la app siempre llama a readData/writeData/transact sin saber
// cual de los dos esta activo.

const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, 'data.json');

const EMPTY_STATE = {
  cards: [],
  orders: [],
  settings: {}
};

const MONGODB_URI = process.env.MONGODB_URI;

// ---------- Motor: archivo local ----------

function ensureFile() {
  if (!fs.existsSync(DATA_PATH)) {
    fs.writeFileSync(DATA_PATH, JSON.stringify(EMPTY_STATE, null, 2));
  }
}

function readFileData() {
  ensureFile();
  const raw = fs.readFileSync(DATA_PATH, 'utf-8');
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.error('No se pudo leer db/data.json, se usara un estado vacio temporalmente.', err);
    return structuredClone(EMPTY_STATE);
  }
}

let fileWriteChain = Promise.resolve();

function writeFileData(data) {
  fileWriteChain = fileWriteChain.then(() => {
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
  });
  return fileWriteChain;
}

// ---------- Motor: MongoDB (opcional) ----------

let mongoCollectionPromise = null;

async function getMongoCollection() {
  if (!mongoCollectionPromise) {
    mongoCollectionPromise = (async () => {
      const { MongoClient } = require('mongodb');
      const client = new MongoClient(MONGODB_URI);
      await client.connect();
      const dbName = process.env.MONGODB_DB || 'holoteca';
      return client.db(dbName).collection('appstate');
    })();
  }
  return mongoCollectionPromise;
}

async function readMongoData() {
  const col = await getMongoCollection();
  const doc = await col.findOne({ _id: 'singleton' });
  if (!doc) {
    const fresh = { _id: 'singleton', ...structuredClone(EMPTY_STATE) };
    await col.insertOne(fresh);
    return fresh;
  }
  return doc;
}

async function writeMongoData(data) {
  const col = await getMongoCollection();
  await col.replaceOne({ _id: 'singleton' }, { ...data, _id: 'singleton' }, { upsert: true });
}

// ---------- Interfaz publica (usada por el resto de la app) ----------

async function readData() {
  return MONGODB_URI ? readMongoData() : readFileData();
}

async function writeData(data) {
  return MONGODB_URI ? writeMongoData(data) : writeFileData(data);
}

async function transact(mutator) {
  const data = await readData();
  const result = await mutator(data);
  await writeData(data);
  return result;
}

module.exports = { readData, writeData, transact };
