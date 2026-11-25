'use strict';

const zlib = require('zlib');

// Minimal CRC32 table for ZIP generation
const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  CRC_TABLE[i] = c >>> 0;
}
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function xmlEscape(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function xmlUnescape(str) {
  return String(str || '')
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function colIndexToLetter(idx) {
  let s = '', n = idx + 1;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function colLetterToIndex(letters) {
  let n = 0;
  for (let i = 0; i < letters.length; i++) {
    n = n * 26 + (letters.charCodeAt(i) - 64);
  }
  return n - 1;
}

// ---------- ZIP BUILDER (STORE METHOD 0) ----------
function buildZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, 'utf8');
    const dataBuf = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
    const crc = crc32(dataBuf);

    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt16LE(0, 6);
    lh.writeUInt16LE(0, 8);
    lh.writeUInt16LE(0, 10);
    lh.writeUInt16LE(0, 12);
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(dataBuf.length, 18);
    lh.writeUInt32LE(dataBuf.length, 22);
    lh.writeUInt16LE(nameBuf.length, 26);
    lh.writeUInt16LE(0, 28);
    localParts.push(lh, nameBuf, dataBuf);

    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(20, 4);
    ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(0, 8);
    ch.writeUInt16LE(0, 10);
    ch.writeUInt16LE(0, 12);
    ch.writeUInt16LE(0, 14);
    ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(dataBuf.length, 20);
    ch.writeUInt32LE(dataBuf.length, 24);
    ch.writeUInt16LE(nameBuf.length, 28);
    ch.writeUInt16LE(0, 30);
    ch.writeUInt16LE(0, 32);
    ch.writeUInt16LE(0, 34);
    ch.writeUInt16LE(0, 36);
    ch.writeUInt32LE(0, 38);
    ch.writeUInt32LE(offset, 42);
    centralParts.push(ch, nameBuf);

    offset += lh.length + nameBuf.length + dataBuf.length;
  }

  const centralBuf = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralBuf, eocd]);
}

// ---------- ZIP READER (SUPPORTS STORE 0 & DEFLATE 8) ----------
function readZipEntries(buf) {
  const files = {};
  // Locate End of Central Directory (EOCD)
  let eocdPos = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocdPos = i;
      break;
    }
  }
  if (eocdPos === -1) throw new Error('Tệp Excel (.xlsx) không hợp lệ.');

  const cdOffset = buf.readUInt32LE(eocdPos + 16);
  const totalEntries = buf.readUInt16LE(eocdPos + 10);
  let pos = cdOffset;

  for (let i = 0; i < totalEntries; i++) {
    if (pos + 46 > buf.length || buf.readUInt32LE(pos) !== 0x02014b50) break;
    const method = buf.readUInt16LE(pos + 10);
    const compSize = buf.readUInt32LE(pos + 20);
    const nameLen = buf.readUInt16LE(pos + 28);
    const extraLen = buf.readUInt16LE(pos + 30);
    const commentLen = buf.readUInt16LE(pos + 32);
    const localOffset = buf.readUInt32LE(pos + 42);
    const name = buf.slice(pos + 46, pos + 46 + nameLen).toString('utf8');
    pos += 46 + nameLen + extraLen + commentLen;

    const lNameLen = buf.readUInt16LE(localOffset + 26);
    const lExtraLen = buf.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + lNameLen + lExtraLen;
    const compData = buf.slice(dataStart, dataStart + compSize);

    if (method === 0) files[name] = compData;
    else if (method === 8) files[name] = zlib.inflateRawSync(compData);
  }
  return files;
}


// ---------- EXTRACT EMBEDDED IMAGES PER ROW FROM XLSX ----------
function extractEmbeddedImagesByRow(entries) {
  const rowImages = {};
  const drawingKeys = Object.keys(entries).filter(k => /^xl\/drawings\/drawing\d+\.xml$/i.test(k));
  const mimeMap = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };

  for (const dKey of drawingKeys) {
    const fileName = dKey.split('/').pop();
    const relsKey = `xl/drawings/_rels/${fileName}.rels`;
    const rIdToTarget = {};
    if (entries[relsKey]) {
      const relXml = entries[relsKey].toString('utf8');
      const relMatches = relXml.match(/<Relationship\b[^>]*>/g) || [];
      for (const rm of relMatches) {
        const idM = rm.match(/\bId="([^"]+)"/);
        const tgtM = rm.match(/\bTarget="([^"]+)"/);
        if (idM && tgtM) {
          let target = tgtM[1].replace(/^(\.\.\/)+/, 'xl/').replace(/^\/+/, '');
          if (!target.startsWith('xl/')) target = 'xl/drawings/' + target;
          rIdToTarget[idM[1]] = target;
        }
      }
    }

    const dXml = entries[dKey].toString('utf8');
    const anchors = dXml.match(/<(?:xdr:)?(?:twoCellAnchor|oneCellAnchor)\b[\s\S]*?<\/(?:xdr:)?(?:twoCellAnchor|oneCellAnchor)>/g) || [];
    for (const anc of anchors) {
      const fromM = anc.match(/<(?:xdr:)?from>[\s\S]*?<(?:xdr:)?row>(\d+)<\/(?:xdr:)?row>[\s\S]*?<\/(?:xdr:)?from>/);
      const blipM = anc.match(/r:embed="([^"]+)"/);
      if (!fromM || !blipM) continue;
      const rowIdx = parseInt(fromM[1], 10);
      const mediaPath = rIdToTarget[blipM[1]];
      if (!mediaPath || !entries[mediaPath]) continue;
      const ext = (mediaPath.split('.').pop() || 'png').toLowerCase();
      const mime = mimeMap[ext] || 'image/png';
      rowImages[rowIdx] = { ext: ext === 'jpeg' ? 'jpg' : ext, mime, buffer: entries[mediaPath] };
    }
  }
  return rowImages;
}

// ---------- PARSE XLSX TO ARRAY OF OBJECTS ----------
function parseXlsxBuffer(buf) {
  const entries = readZipEntries(buf);
  const sharedStrings = [];
  if (entries['xl/sharedStrings.xml']) {
    const ssXml = entries['xl/sharedStrings.xml'].toString('utf8');
    const siMatches = ssXml.match(/<si\b[^>]*>[\s\S]*?<\/si>/g) || [];
    for (const si of siMatches) {
      const tMatches = si.match(/<t\b[^>]*>([\s\S]*?)<\/t>/g) || [];
      const text = tMatches.map(t => xmlUnescape(t.replace(/<[^>]+>/g, ''))).join('');
      sharedStrings.push(text);
    }
  }

  const sheetKey = Object.keys(entries).find(k => /^xl\/worksheets\/sheet\d+\.xml$/i.test(k));
  if (!sheetKey) throw new Error('Không tìm thấy sheet dữ liệu trong tệp Excel.');

  const sheetXml = entries[sheetKey].toString('utf8');
  const rowMatches = sheetXml.match(/<row\b[^>]*>[\s\S]*?<\/row>/g) || [];
  const rowImages = extractEmbeddedImagesByRow(entries);
  const matrix = [];

  for (const rowXml of rowMatches) {
    const rNumM = rowXml.match(/\br="(\d+)"/);
    const excelRowIdx = rNumM ? parseInt(rNumM[1], 10) - 1 : matrix.length;
    const rowArr = [];
    const cellMatches = rowXml.match(/<c\b[^>]*>(?:[\s\S]*?<\/c>)?/g) || [];
    for (const cellXml of cellMatches) {
      const refM = cellXml.match(/\br="([A-Z]+)\d+"/i);
      const colIdx = refM ? colLetterToIndex(refM[1].toUpperCase()) : rowArr.length;
      const typeM = cellXml.match(/\bt="([^"]+)"/);
      const type = typeM ? typeM[1] : '';
      let val = '';

      if (type === 's') {
        const vM = cellXml.match(/<v>([\s\S]*?)<\/v>/);
        const idx = vM ? parseInt(vM[1], 10) : -1;
        val = sharedStrings[idx] ?? '';
      } else if (type === 'inlineStr') {
        const tMs = cellXml.match(/<t\b[^>]*>([\s\S]*?)<\/t>/g) || [];
        val = tMs.map(t => xmlUnescape(t.replace(/<[^>]+>/g, ''))).join('');
      } else {
        const vM = cellXml.match(/<v>([\s\S]*?)<\/v>/);
        val = vM ? xmlUnescape(vM[1]) : '';
      }
      rowArr[colIdx] = val;
    }
    if (rowArr.some(v => String(v ?? '').trim() !== '')) {
      matrix.push({ rowIdx: excelRowIdx, cells: rowArr });
    }
  }

  if (matrix.length < 2) return [];
  const headers = matrix[0].cells.map(h => String(h || '').trim().toLowerCase());
  const records = [];
  for (let r = 1; r < matrix.length; r++) {
    const obj = {};
    headers.forEach((hd, idx) => {
      if (hd) obj[hd] = matrix[r].cells[idx] ?? '';
    });
    const img = rowImages[matrix[r].rowIdx];
    if (img) obj._embeddedImage = img;
    records.push(obj);
  }
  return records;
}

// ---------- WRITE ARRAY OF ROWS TO VALID XLSX BUFFER ----------
function buildXlsxBuffer(rows, sheetName = 'SanPham') {
  const rowXmls = rows.map((row, rIdx) => {
    const cells = row.map((val, cIdx) => {
      const ref = `${colIndexToLetter(cIdx)}${rIdx + 1}`;
      if (typeof val === 'number' && isFinite(val)) {
        return `<c r="${ref}"><v>${val}</v></c>`;
      }
      return `<c r="${ref}" t="inlineStr"><is><t>${xmlEscape(val)}</t></is></c>`;
    }).join('');
    return `<row r="${rIdx + 1}">${cells}</row>`;
  }).join('');

  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rowXmls}</sheetData></worksheet>`;

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xmlEscape(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`;

  const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`;

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`;

  return buildZip([
    { name: '[Content_Types].xml', data: contentTypes },
    { name: '_rels/.rels', data: rootRels },
    { name: 'xl/workbook.xml', data: workbookXml },
    { name: 'xl/_rels/workbook.xml.rels', data: wbRels },
    { name: 'xl/worksheets/sheet1.xml', data: sheetXml }
  ]);
}

module.exports = { parseXlsxBuffer, buildXlsxBuffer };
