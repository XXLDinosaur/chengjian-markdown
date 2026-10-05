const sharp = require('sharp');
const fs = require('node:fs/promises');
const path = require('node:path');
(async () => {
  const assets = path.resolve(__dirname, '../assets');
  const source = path.join(assets, 'app-icon.svg');
  await sharp(source).resize(512, 512).png().toFile(path.join(assets, 'app-icon.png'));
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const images = await Promise.all(sizes.map(size => sharp(source).resize(size, size).png().toBuffer()));
  const directory = Buffer.alloc(6 + 16 * sizes.length); directory.writeUInt16LE(1, 2); directory.writeUInt16LE(sizes.length, 4);
  let offset = directory.length;
  sizes.forEach((size, i) => { const entry = 6 + i * 16; directory[entry] = directory[entry + 1] = size === 256 ? 0 : size; directory.writeUInt16LE(1, entry + 4); directory.writeUInt16LE(32, entry + 6); directory.writeUInt32LE(images[i].length, entry + 8); directory.writeUInt32LE(offset, entry + 12); offset += images[i].length; });
  await fs.writeFile(path.join(assets, 'app-icon.ico'), Buffer.concat([directory, ...images]));
  console.log('Generated application PNG and multi-resolution Windows ICO (16–256 px).');
})().catch(error => { console.error(error); process.exitCode = 1; });
