import { HttpError } from './http';

const DEVICE_TOKEN_PATTERN = /^[A-Za-z0-9._~-]{32,200}$/;
const SIGNED_TOKEN_PATTERN = /^cw1\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]{43})$/;

interface DeviceTokenPayload {
  version: 1;
  ownerId: string;
  expiresAt: number;
}

export function deviceTokenFrom(request: Request): string {
  const token = request.headers.get('x-device-token')?.trim() ?? '';
  if (!DEVICE_TOKEN_PATTERN.test(token)) {
    throw new HttpError(
      401,
      'DEVICE_TOKEN_REQUIRED',
      'A valid device ownership token is required.',
    );
  }
  return token;
}

export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function issueDeviceToken(
  secret: string,
  now: Date,
  lifetimeDays = 400,
): Promise<{ token: string; expiresAt: string }> {
  const expiresAt = new Date(now.getTime() + lifetimeDays * 86_400_000);
  const payload: DeviceTokenPayload = {
    version: 1,
    ownerId: randomSlug(24),
    expiresAt: expiresAt.getTime(),
  };
  const encodedPayload = base64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await sign(encodedPayload, secret);
  return { token: `cw1.${encodedPayload}.${signature}`, expiresAt: expiresAt.toISOString() };
}

export async function ownerHashFrom(
  request: Request,
  secret: string,
  nowMilliseconds = Date.now(),
): Promise<string> {
  const token = deviceTokenFrom(request);
  const match = SIGNED_TOKEN_PATTERN.exec(token);
  if (!match) throw invalidDeviceToken();
  const encodedPayload = match[1];
  const suppliedSignature = match[2];
  if (!encodedPayload || !suppliedSignature) throw invalidDeviceToken();
  const expectedSignature = await sign(encodedPayload, secret);
  if (!constantTimeEqual(suppliedSignature, expectedSignature)) throw invalidDeviceToken();

  let payload: DeviceTokenPayload;
  try {
    payload = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(fromBase64Url(encodedPayload))) as DeviceTokenPayload;
  } catch {
    throw invalidDeviceToken();
  }
  if (
    payload.version !== 1 ||
    !/^[A-Za-z0-9_-]{32}$/.test(payload.ownerId) ||
    !Number.isSafeInteger(payload.expiresAt) ||
    payload.expiresAt <= nowMilliseconds
  ) {
    throw invalidDeviceToken();
  }
  return sha256(`owner:${payload.ownerId}`);
}

export async function networkHashFrom(request: Request): Promise<string> {
  const address = request.headers.get('cf-connecting-ip')?.trim() || 'local-or-unknown';
  return sha256(`network:${address}`);
}

export function randomSlug(byteLength = 15): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

async function sign(value: string, secret: string): Promise<string> {
  if (secret.length < 32) {
    throw new Error('DEVICE_TOKEN_SIGNING_SECRET must contain at least 32 characters.');
  }
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return base64Url(new Uint8Array(signature));
}

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): Uint8Array {
  const standard = value.replaceAll('-', '+').replaceAll('_', '/');
  const padded = standard.padEnd(Math.ceil(standard.length / 4) * 4, '=');
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function invalidDeviceToken(): HttpError {
  return new HttpError(
    401,
    'DEVICE_REGISTRATION_REQUIRED',
    'Enter a valid workshop access code on this iPad before using Studio.',
  );
}
