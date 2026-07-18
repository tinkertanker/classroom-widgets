import { HttpError } from './http';

export interface InspectedImage {
  width: number;
  height: number;
}

export function inspectImage(bytes: ArrayBuffer, contentType: string): InspectedImage {
  const data = new Uint8Array(bytes);
  switch (contentType) {
    case 'image/png':
      return inspectPng(data);
    case 'image/jpeg':
      return inspectJpeg(data);
    case 'image/webp':
      return inspectWebP(data);
    default:
      throw invalidImage();
  }
}

function inspectPng(data: Uint8Array): InspectedImage {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (data.length < 33 || !signature.every((byte, index) => data[index] === byte)) {
    throw invalidImage();
  }

  let offset = 8;
  let dimensions: InspectedImage | undefined;
  while (offset + 12 <= data.length) {
    const length = readUint32BigEndian(data, offset);
    const type = ascii(data, offset + 4, 4);
    const next = offset + 12 + length;
    if (next > data.length) throw invalidImage();
    if (type === 'IHDR') {
      if (length !== 13) throw invalidImage();
      dimensions = {
        width: readUint32BigEndian(data, offset + 8),
        height: readUint32BigEndian(data, offset + 12),
      };
    }
    if (['eXIf', 'iTXt', 'tEXt', 'zTXt'].includes(type)) throw metadataPresent();
    offset = next;
    if (type === 'IEND') break;
  }
  return validDimensions(dimensions);
}

function inspectJpeg(data: Uint8Array): InspectedImage {
  if (data.length < 4 || data[0] !== 0xff || data[1] !== 0xd8) throw invalidImage();
  let offset = 2;
  let dimensions: InspectedImage | undefined;
  let sawScan = false;
  while (offset < data.length) {
    if (data[offset] !== 0xff) throw invalidImage();
    while (data[offset] === 0xff) offset += 1;
    const marker = data[offset];
    offset += 1;
    if (marker === undefined || marker === 0x00 || marker === 0xd8) throw invalidImage();
    if (marker === 0xd9) {
      if (!sawScan || offset !== data.length) throw invalidImage();
      return validDimensions(dimensions);
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      if (!sawScan) throw invalidImage();
      continue;
    }
    if (offset + 2 > data.length) throw invalidImage();
    const length = readUint16BigEndian(data, offset);
    if (length < 2 || offset + length > data.length) throw invalidImage();
    if ((marker >= 0xe1 && marker <= 0xef) || marker === 0xfe) throw metadataPresent();
    if (isStartOfFrame(marker)) {
      if (length < 7) throw invalidImage();
      dimensions = validDimensions({
        height: readUint16BigEndian(data, offset + 3),
        width: readUint16BigEndian(data, offset + 5),
      });
    }
    offset += length;
    if (marker !== 0xda) continue;

    sawScan = true;
    let foundNextMarker = false;
    while (offset < data.length) {
      if (data[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const markerOffset = offset;
      while (data[offset] === 0xff) offset += 1;
      const scanMarker = data[offset];
      if (scanMarker === undefined) throw invalidImage();
      if (scanMarker === 0x00 || (scanMarker >= 0xd0 && scanMarker <= 0xd7)) {
        offset += 1;
        continue;
      }
      offset = markerOffset;
      foundNextMarker = true;
      break;
    }
    if (!foundNextMarker) throw invalidImage();
  }
  throw invalidImage();
}

function inspectWebP(data: Uint8Array): InspectedImage {
  if (
    data.length < 30 ||
    ascii(data, 0, 4) !== 'RIFF' ||
    ascii(data, 8, 4) !== 'WEBP' ||
    readUint32LittleEndian(data, 4) + 8 !== data.length
  ) {
    throw invalidImage();
  }

  let offset = 12;
  let dimensions: InspectedImage | undefined;
  while (offset + 8 <= data.length) {
    const type = ascii(data, offset, 4);
    const length = readUint32LittleEndian(data, offset + 4);
    const start = offset + 8;
    const next = start + length + (length % 2);
    if (next > data.length) throw invalidImage();
    if (type === 'EXIF' || type === 'XMP ') throw metadataPresent();
    if (type === 'VP8X' && length >= 10) {
      dimensions = {
        width: 1 + readUint24LittleEndian(data, start + 4),
        height: 1 + readUint24LittleEndian(data, start + 7),
      };
    } else if (type === 'VP8L' && length >= 5 && data[start] === 0x2f) {
      const byte1 = data[start + 1] ?? 0;
      const byte2 = data[start + 2] ?? 0;
      const byte3 = data[start + 3] ?? 0;
      const byte4 = data[start + 4] ?? 0;
      dimensions = {
        width: 1 + (((byte2 & 0x3f) << 8) | byte1),
        height: 1 + (((byte4 & 0x0f) << 10) | (byte3 << 2) | ((byte2 & 0xc0) >> 6)),
      };
    } else if (
      type === 'VP8 ' &&
      length >= 10 &&
      data[start + 3] === 0x9d &&
      data[start + 4] === 0x01 &&
      data[start + 5] === 0x2a
    ) {
      dimensions = {
        width: readUint16LittleEndian(data, start + 6) & 0x3fff,
        height: readUint16LittleEndian(data, start + 8) & 0x3fff,
      };
    }
    offset = next;
  }
  return validDimensions(dimensions);
}

function isStartOfFrame(marker: number): boolean {
  return [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(
    marker,
  );
}

function validDimensions(value: InspectedImage | undefined): InspectedImage {
  if (
    !value ||
    !Number.isInteger(value.width) ||
    !Number.isInteger(value.height) ||
    value.width < 1 ||
    value.height < 1 ||
    value.width > 4_096 ||
    value.height > 4_096
  ) {
    throw invalidImage();
  }
  return value;
}

function ascii(data: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...data.slice(offset, offset + length));
}

function readUint16BigEndian(data: Uint8Array, offset: number): number {
  return ((data[offset] ?? 0) << 8) | (data[offset + 1] ?? 0);
}

function readUint16LittleEndian(data: Uint8Array, offset: number): number {
  return (data[offset] ?? 0) | ((data[offset + 1] ?? 0) << 8);
}

function readUint24LittleEndian(data: Uint8Array, offset: number): number {
  return (
    (data[offset] ?? 0) |
    ((data[offset + 1] ?? 0) << 8) |
    ((data[offset + 2] ?? 0) << 16)
  );
}

function readUint32BigEndian(data: Uint8Array, offset: number): number {
  return new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(offset, false);
}

function readUint32LittleEndian(data: Uint8Array, offset: number): number {
  return new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(offset, true);
}

function invalidImage(): HttpError {
  return new HttpError(
    422,
    'INVALID_IMAGE_BYTES',
    'The uploaded bytes do not match a supported image or contain invalid dimensions.',
  );
}

function metadataPresent(): HttpError {
  return new HttpError(
    422,
    'IMAGE_METADATA_PRESENT',
    'Remove image metadata before uploading.',
  );
}
