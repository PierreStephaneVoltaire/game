/* eslint-disable no-undef */
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { inflateSync } from 'node:zlib';

const assetDirectory = new URL('../static/items/generated/', import.meta.url);
const catalogueUrl = new URL(
  '../src/lib/data/shop-items.json',
  import.meta.url,
);
const companionDirectory = new URL('../static/companions/', import.meta.url);
const petProfileUrl = new URL(
  '../src/lib/data/pet-profile.json',
  import.meta.url,
);
const catalogue = JSON.parse(await readFile(catalogueUrl, 'utf8'));
const petProfile = JSON.parse(await readFile(petProfileUrl, 'utf8'));
const files = new Set(
  (await readdir(assetDirectory)).filter((file) => file.endsWith('.png')),
);
const issues = [];
const hashes = new Map();

const crcTable = Array.from({ length: 256 }, (_, entry) => {
  let value = entry;
  for (let bit = 0; bit < 8; bit += 1)
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function validatePng(bytes, filename) {
  const messages = [];
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (bytes.length < 33 || !bytes.subarray(0, 8).equals(signature))
    return ['invalid PNG signature or truncated header'];

  let offset = 8;
  let header;
  let sawEnd = false;
  const imageData = [];
  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) {
      messages.push('truncated PNG chunk');
      break;
    }
    const length = bytes.readUInt32BE(offset);
    const end = offset + 12 + length;
    if (end > bytes.length) {
      messages.push('PNG chunk exceeds file length');
      break;
    }
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    const expectedCrc = bytes.readUInt32BE(offset + 8 + length);
    if (crc32(bytes.subarray(offset + 4, offset + 8 + length)) !== expectedCrc)
      messages.push(`${type} chunk has an invalid CRC`);
    if (type === 'IHDR') header = data;
    if (type === 'IDAT') imageData.push(data);
    if (type === 'IEND') {
      sawEnd = true;
      if (end !== bytes.length) messages.push('data follows the IEND chunk');
      break;
    }
    offset = end;
  }

  if (!header || header.length !== 13)
    messages.push('missing valid IHDR chunk');
  if (!imageData.length) messages.push('missing IDAT image data');
  if (!sawEnd) messages.push('missing IEND chunk');
  if (!header || header.length !== 13 || !imageData.length) return messages;

  const width = header.readUInt32BE(0);
  const height = header.readUInt32BE(4);
  const bitDepth = header[8];
  const colorType = header[9];
  const compression = header[10];
  const filter = header[11];
  const interlace = header[12];
  if (
    width !== 256 ||
    height !== 256 ||
    bitDepth !== 8 ||
    ![4, 6].includes(colorType) ||
    compression !== 0 ||
    filter !== 0 ||
    interlace !== 0
  )
    messages.push('expected a non-interlaced 256x256 8-bit PNG with alpha');

  try {
    const pixels = inflateSync(Buffer.concat(imageData));
    const bytesPerPixel = colorType === 6 ? 4 : 2;
    const rowLength = 1 + width * bytesPerPixel;
    if (pixels.length !== height * rowLength)
      messages.push('inflated pixel data has an unexpected length');
    else
      for (let row = 0; row < height; row += 1)
        if (pixels[row * rowLength] > 4) {
          messages.push(`scanline ${row} has an invalid filter`);
          break;
        }
  } catch (error) {
    messages.push(
      `IDAT data cannot be inflated: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return messages.map((message) => `${filename}: ${message}`);
}

if (catalogue.length !== 232)
  issues.push(`expected 232 catalogue entries, found ${catalogue.length}`);
const paths = catalogue.map((item) => item.image);
if (new Set(paths).size !== catalogue.length)
  issues.push('catalogue references must use unique PNG paths');

for (const item of catalogue) {
  const filename = `${item.id}.png`;
  if (!files.has(filename)) {
    issues.push(`${item.id}: missing generated PNG`);
    continue;
  }
  const bytes = await readFile(new URL(filename, assetDirectory));
  issues.push(...validatePng(bytes, filename));
  const hash = createHash('sha256').update(bytes).digest('hex');
  const expected = `/items/generated/${filename}?v=${hash.slice(0, 12)}`;
  if (item.image !== expected)
    issues.push(`${item.id}: expected image ${expected}`);
  const duplicate = hashes.get(hash);
  if (duplicate)
    issues.push(`${filename}: duplicates the bytes of ${duplicate}`);
  else hashes.set(hash, filename);
}

for (const file of files) {
  if (
    !catalogue.some((item) =>
      item.image.startsWith(`/items/generated/${file}?v=`),
    )
  )
    issues.push(`${file}: not referenced by the canonical catalogue`);
}

const companionFiles = new Set(
  (await readdir(companionDirectory)).filter((file) => file.endsWith('.png')),
);
const companionAppearances = petProfile.appearances.filter(
  (appearance) => appearance.id !== 'classic',
);
if (companionAppearances.length !== 4)
  issues.push(
    `expected 4 configured companion appearances, found ${companionAppearances.length}`,
  );
for (const appearance of companionAppearances) {
  const filename = appearance.assetPath.replace('/companions/', '');
  if (!companionFiles.has(filename)) {
    issues.push(
      `${appearance.id}: missing companion asset ${appearance.assetPath}`,
    );
    continue;
  }
  const bytes = await readFile(new URL(filename, companionDirectory));
  issues.push(...validatePng(bytes, `companions/${filename}`));
}
for (const file of companionFiles)
  if (
    !companionAppearances.some(
      (appearance) => appearance.assetPath === `/companions/${file}`,
    )
  )
    issues.push(`${file}: not referenced by the companion profile`);

if (issues.length) {
  console.error(issues.join('\n'));
  process.exit(1);
}
console.log(
  `validated ${catalogue.length} catalogue PNGs and ${companionAppearances.length} companion appearances across ${companionFiles.size} ${companionFiles.size === 1 ? 'PNG' : 'PNGs'}`,
);
