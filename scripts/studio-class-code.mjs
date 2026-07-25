import { randomInt } from 'node:crypto';

const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

export function parseClassNumber(value, usage = 'Expected a four-digit class number.') {
  if (typeof value !== 'string' || !/^\d{4}$/.test(value)) {
    throw new Error(usage);
  }
  return value;
}

export function parseMaximumUses(value, usage = 'Expected maximum uses from 1 to 100.') {
  if (typeof value !== 'string' || !/^\d{1,3}$/.test(value)) {
    throw new Error(usage);
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 100) {
    throw new Error(usage);
  }
  return parsed;
}

export function createClassCode(classNumber, selectIndex = (length) => randomInt(length)) {
  const prefix = parseClassNumber(classNumber);
  const suffix = Array.from({ length: 4 }, () => LETTERS[selectIndex(LETTERS.length)]).join('');
  return `${prefix}${suffix}`;
}

export function normaliseClassCode(value) {
  if (typeof value !== 'string') return null;
  const compact = value.trim().toUpperCase().replace('-', '');
  return /^\d{4}[A-Z]{4}$/.test(compact) ? compact : null;
}
