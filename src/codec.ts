import { gunzipSync, gzipSync } from 'node:zlib';

import { StatusListError } from './errors';

export const MULTIBASE_BASE64URL_PREFIX = 'u';
export const MIN_UNCOMPRESSED_BYTE_LENGTH = 16 * 1024; // 16KB

function toBase64Url(buffer: Buffer): string {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fromBase64Url(value: string): Buffer {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4;
  const padded = padding === 0 ? normalized : normalized + '='.repeat(4 - padding);
  return Buffer.from(padded, 'base64');
}

export function encodeBitstring(uncompressed: Uint8Array): string {
  if (uncompressed.byteLength < MIN_UNCOMPRESSED_BYTE_LENGTH) {
    throw new StatusListError(
      'STATUS_LIST_LENGTH_ERROR',
      `Bitstring must be at least ${MIN_UNCOMPRESSED_BYTE_LENGTH} bytes (16KB) before compression.`
    );
  }

  const compressed = gzipSync(uncompressed);
  const base64url = toBase64Url(Buffer.from(compressed));
  return `${MULTIBASE_BASE64URL_PREFIX}${base64url}`;
}

export function decodeBitstring(encoded: string): Uint8Array {
  if (!encoded || encoded[0] !== MULTIBASE_BASE64URL_PREFIX) {
    throw new StatusListError(
      'MALFORMED_VALUE_ERROR',
      'Encoded list must be multibase base64url prefixed with "u".'
    );
  }

  const data = encoded.slice(1);
  const compressed = fromBase64Url(data);
  try {
    const uncompressed = gunzipSync(compressed);
    return new Uint8Array(uncompressed);
  } catch (error) {
    throw new StatusListError('MALFORMED_VALUE_ERROR', 'Failed to decode encodedList payload.', {
      cause: error,
    });
  }
}
