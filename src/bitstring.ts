import { decodeBitstring, encodeBitstring, MIN_UNCOMPRESSED_BYTE_LENGTH } from './codec';
import { StatusListError, assert } from './errors';

export interface BitstringStatusListInit {
  /**
   * Number of status entries that the bitstring needs to store.
   * Defaults to the minimum entry count required by the specification.
   */
  entryCount?: number;
  /**
   * Number of bits allocated per status entry. Defaults to 1.
   */
  statusSize?: number;
  /**
   * Optional uncompressed byte array backing the bitstring.
   * When provided, the array will be copied to avoid external mutation.
   */
  source?: Uint8Array;
  /**
   * Override for the minimum number of entries enforced by the library.
   * Mainly useful for testing or bespoke ecosystems whose specification overrides the default.
   */
  minimumEntries?: number;
}

export interface DecodeOptions {
  statusSize?: number;
  minimumEntries?: number;
  entryCount?: number;
}

const MINIMUM_ENTRY_COUNT = 131_072;

export class BitstringStatusList {
  readonly statusSize: number;
  readonly entryCount: number;
  private readonly bytes: Uint8Array;

  constructor(init: BitstringStatusListInit = {}) {
    const minimumEntries = init.minimumEntries ?? MINIMUM_ENTRY_COUNT;
    if (!Number.isInteger(minimumEntries) || minimumEntries < 1) {
      throw new StatusListError('MALFORMED_VALUE_ERROR', 'minimumEntries must be a positive integer.');
    }

    this.statusSize = init.statusSize ?? 1;
    if (!Number.isInteger(this.statusSize) || this.statusSize < 1) {
      throw new StatusListError('MALFORMED_VALUE_ERROR', 'statusSize must be a positive integer.');
    }

    if (init.source) {
      this.bytes = init.source.slice();
      if (this.bytes.byteLength < MIN_UNCOMPRESSED_BYTE_LENGTH) {
        throw new StatusListError(
          'STATUS_LIST_LENGTH_ERROR',
          'Decoded bitstring is shorter than 16KB minimum length.'
        );
      }
      const capacity = Math.floor((this.bytes.length * 8) / this.statusSize);
      assert(
        capacity >= minimumEntries,
        'STATUS_LIST_LENGTH_ERROR',
        `Bitstring capacity (${capacity}) is smaller than the minimum required entries (${minimumEntries}).`
      );

      if (init.entryCount !== undefined) {
        if (!Number.isInteger(init.entryCount) || init.entryCount < 1) {
          throw new StatusListError('MALFORMED_VALUE_ERROR', 'entryCount must be a positive integer.');
        }
        assert(
          init.entryCount <= capacity,
          'STATUS_LIST_LENGTH_ERROR',
          `entryCount (${init.entryCount}) exceeds bitstring capacity (${capacity}).`
        );
        this.entryCount = init.entryCount;
      } else {
        this.entryCount = capacity;
      }
    } else {
      const baseEntryCount = init.entryCount ?? minimumEntries;
      if (!Number.isInteger(baseEntryCount) || baseEntryCount < 1) {
        throw new StatusListError('MALFORMED_VALUE_ERROR', 'entryCount must be a positive integer.');
      }
      this.entryCount = Math.max(baseEntryCount, minimumEntries);

      const totalBits = this.entryCount * this.statusSize;
      const byteLength = Math.ceil(totalBits / 8);
      const safeByteLength = Math.max(byteLength, MIN_UNCOMPRESSED_BYTE_LENGTH);
      this.bytes = new Uint8Array(safeByteLength);
    }
  }

  static fromEncoded(encodedList: string, options: DecodeOptions = {}): BitstringStatusList {
    const bytes = decodeBitstring(encodedList);
    return new BitstringStatusList({
      source: bytes,
      statusSize: options.statusSize,
      entryCount: options.entryCount,
      minimumEntries: options.minimumEntries,
    });
  }

  encode(): string {
    return encodeBitstring(this.toUint8Array(false));
  }

  getEntry(index: number): number {
    this.assertIndex(index);
    let value = 0;
    const base = index * this.statusSize;
    for (let offset = 0; offset < this.statusSize; offset += 1) {
      const bitIndex = base + offset;
      value = (value << 1) | this.getBit(bitIndex);
    }
    return value;
  }

  setEntry(index: number, value: number): void {
    this.assertIndex(index);
    if (!Number.isInteger(value) || value < 0) {
      throw new StatusListError('MALFORMED_VALUE_ERROR', 'Status value must be a non-negative integer.');
    }
    const maxValue = 2 ** this.statusSize;
    assert(value < maxValue, 'RANGE_ERROR', `Status value ${value} exceeds maximum encodable value ${maxValue - 1}.`);

    const base = index * this.statusSize;
    for (let offset = 0; offset < this.statusSize; offset += 1) {
      const shift = this.statusSize - offset - 1;
      const bit = (value >> shift) & 0b1;
      this.setBit(base + offset, bit === 1);
    }
  }

  fill(value = 0): void {
    for (let i = 0; i < this.entryCount; i += 1) {
      this.setEntry(i, value);
    }
  }

  get statusBitLength(): number {
    return this.bytes.length * 8;
  }

  toUint8Array(copy = true): Uint8Array {
    return copy ? this.bytes.slice() : this.bytes;
  }

  private assertIndex(index: number): void {
    if (!Number.isInteger(index) || index < 0 || index >= this.entryCount) {
      throw new StatusListError('RANGE_ERROR', `Index ${index} is outside of range 0-${this.entryCount - 1}.`);
    }
  }

  private getBit(bitIndex: number): 0 | 1 {
    this.assertBitIndex(bitIndex);
    const byteIndex = Math.floor(bitIndex / 8);
    const bitOffset = 7 - (bitIndex % 8);
    const mask = 1 << bitOffset;
    return (this.bytes[byteIndex] & mask) !== 0 ? 1 : 0;
  }

  private setBit(bitIndex: number, value: boolean): void {
    this.assertBitIndex(bitIndex);
    const byteIndex = Math.floor(bitIndex / 8);
    const bitOffset = 7 - (bitIndex % 8);
    const mask = 1 << bitOffset;
    if (value) {
      this.bytes[byteIndex] |= mask;
    } else {
      this.bytes[byteIndex] &= ~mask;
    }
  }

  private assertBitIndex(bitIndex: number): void {
    if (!Number.isInteger(bitIndex) || bitIndex < 0 || bitIndex >= this.statusBitLength) {
      throw new StatusListError('RANGE_ERROR', `Bit index ${bitIndex} is outside of range 0-${this.statusBitLength - 1}.`);
    }
  }
}

export { MINIMUM_ENTRY_COUNT };
