const fs = require('fs');
const path = require('path');

function getPython(envVar) {
  if (envVar && process.env[envVar]) {
    return process.env[envVar];
  }
  if (process.platform === 'win32') {
    const venv = path.join(process.cwd(), 'venv', 'Scripts', 'python.exe');
    if (fs.existsSync(venv)) return venv;
    return 'python';
  }
  return 'python3';
}

module.exports = { getPython };
