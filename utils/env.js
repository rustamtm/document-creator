const fs = require('fs');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  fs.accessSync(dir, fs.constants.R_OK | fs.constants.W_OK);
}

function validateEnv() {
  process.env.PORT = process.env.PORT || '3000';
  ['logs', 'uploads', 'media', 'runs'].forEach(ensureDir);
}

module.exports = { validateEnv };
