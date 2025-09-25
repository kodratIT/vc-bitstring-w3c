import { decodeBitstring, MULTIBASE_BASE64URL_PREFIX, MIN_UNCOMPRESSED_BYTE_LENGTH } from '@/src/index';
import { getSummary } from '@/lib/simulator';

function fromBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4;
  const padded = padding === 0 ? normalized : normalized + '='.repeat(4 - padding);
  const binary = typeof window !== 'undefined'
    ? atob(padded)
    : Buffer.from(padded, 'base64').toString('binary');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export interface CryptoDetails {
  prefix: string;
  prefixValid: boolean;
  encodedListLength: number;
  base64urlPayloadLength: number;
  compressedByteLength: number;
  uncompressedByteLength: number;
  compressionRatio: number;
  minimumRequiredUncompressedBytes: number;
  previewHex: string;
}

export function getCryptoDetails(): CryptoDetails {
  const summary = getSummary();
  const encodedList = summary.encodedList;
  const prefix = encodedList.slice(0, 1);
  const payload = encodedList.slice(1);
  const prefixValid = prefix === MULTIBASE_BASE64URL_PREFIX;

  const compressedBytes = fromBase64Url(payload);
  let uncompressedBytes: Uint8Array;
  try {
    uncompressedBytes = decodeBitstring(encodedList);
  } catch {
    uncompressedBytes = new Uint8Array(0);
  }

  const previewSlice = uncompressedBytes.slice(0, 16);
  const previewHex = Array.from(previewSlice)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(' ');

  const compressedByteLength = compressedBytes.length;
  const uncompressedByteLength = uncompressedBytes.length;
  const compressionRatio =
    uncompressedByteLength > 0 ? compressedByteLength / uncompressedByteLength : 0;

  return {
    prefix,
    prefixValid,
    encodedListLength: encodedList.length,
    base64urlPayloadLength: payload.length,
    compressedByteLength,
    uncompressedByteLength,
    compressionRatio,
    minimumRequiredUncompressedBytes: MIN_UNCOMPRESSED_BYTE_LENGTH,
    previewHex,
  };
}