// Node.js fs helpers for Electron/Node context
const fs = window.require ? window.require('fs') : null;

export async function readFile(path) {
  if (!fs) throw new Error('fs not available');
  return fs.promises.readFile(path, 'utf-8');
}

export async function writeFile(path, content) {
  if (!fs) throw new Error('fs not available');
  return fs.promises.writeFile(path, content, 'utf-8');
}
