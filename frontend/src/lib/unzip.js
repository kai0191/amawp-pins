// Minimal ZIP reader (stored + deflate) using the browser's DecompressionStream, for Canva multi-page exports.
export async function unzipImages(file) {
  const buf = new Uint8Array(await file.arrayBuffer());
  const dv = new DataView(buf.buffer);
  // find End Of Central Directory
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('This is not a valid .zip file.');
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const out = [];
  const dec = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true);
    const csize = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const commentLen = dv.getUint16(p + 32, true);
    const local = dv.getUint32(p + 42, true);
    const name = dec.decode(buf.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;
    if (!/\.(png|jpe?g|webp)$/i.test(name) || name.startsWith('__MACOSX')) continue;
    const lNameLen = dv.getUint16(local + 26, true);
    const lExtraLen = dv.getUint16(local + 28, true);
    const start = local + 30 + lNameLen + lExtraLen;
    const data = buf.subarray(start, start + csize);
    let bytes;
    if (method === 0) bytes = data;
    else if (method === 8) bytes = new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
    else continue;
    const type = /\.png$/i.test(name) ? 'image/png' : /\.webp$/i.test(name) ? 'image/webp' : 'image/jpeg';
    out.push(new File([bytes], name.split('/').pop(), { type }));
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}

/** "fall-decor-ideas_2.png" -> "Fall Decor Ideas" */
export function titleFromFilename(name) {
  return name.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').replace(/\s*\(\d+\)\s*$/, '').replace(/\s+\d+$/, '').trim()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}
