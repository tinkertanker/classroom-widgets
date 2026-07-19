import { HttpError } from './http';

export interface InspectedImage {
  width: number;
  height: number;
}

/** Strictly validates the canonical JPEG emitted by the Images binding. */
export function inspectCanonicalJpeg(bytes: ArrayBuffer): InspectedImage {
  const data = new Uint8Array(bytes);
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
      if (dimensions || length < 7) throw invalidImage();
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

function readUint16BigEndian(data: Uint8Array, offset: number): number {
  return ((data[offset] ?? 0) << 8) | (data[offset + 1] ?? 0);
}

function invalidImage(): HttpError {
  return new HttpError(
    422,
    'INVALID_IMAGE_BYTES',
    'The image normaliser returned invalid canonical JPEG bytes.',
  );
}

function metadataPresent(): HttpError {
  return new HttpError(
    422,
    'IMAGE_METADATA_PRESENT',
    'The image normaliser returned JPEG metadata unexpectedly.',
  );
}
