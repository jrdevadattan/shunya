// Runs under Electron (not plain Node): converts every PNG in a directory to a
// real baseline JPEG using Chromium's encoder. Used by make-demo-image.mjs so
// the demo evidence contains genuinely decodable photographs.
const { app, nativeImage } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const directory = process.argv[2];
const quality = Number(process.argv[3] || 88);

app.whenReady().then(() => {
  try {
    for (const name of fs.readdirSync(directory)) {
      if (!name.toLowerCase().endsWith('.png')) continue;
      const image = nativeImage.createFromPath(path.join(directory, name));
      if (image.isEmpty()) throw new Error(`could not decode ${name}`);
      fs.writeFileSync(path.join(directory, name.replace(/\.png$/i, '.jpg')), image.toJPEG(quality));
    }
    app.exit(0);
  } catch (error) {
    console.error(String(error));
    app.exit(2);
  }
});
