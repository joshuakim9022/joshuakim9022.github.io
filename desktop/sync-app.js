// Copies the web app from ../skills into ./app so the web version stays the single source of truth.
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'skills');
const dest = path.join(__dirname, 'app');

fs.rmSync(dest, { recursive: true, force: true });
fs.cpSync(src, dest, { recursive: true });
// the service worker is only for the browser version
fs.rmSync(path.join(dest, 'sw.js'), { force: true });
