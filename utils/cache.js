const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const cacheDir = path.join(__dirname, '..', 'data', 'cache');
fs.mkdirSync(cacheDir, { recursive: true });

function keyFor(buffer, ext) {
  const hash = crypto.createHash('sha256').update(buffer).digest('hex');
  return path.join(cacheDir, `${hash}${ext}`);
}

function get(buffer, ext) {
  const file = keyFor(buffer, ext);
  if (fs.existsSync(file)) {
    return fs.readFileSync(file);
  }
  return null;
}

function set(buffer, ext, data) {
  const file = keyFor(buffer, ext);
  fs.writeFileSync(file, data);
}

module.exports = { get, set };
