import { BitstringStatusList } from './bitstring';
import { StatusListError } from './errors';
import { StatusMessage, StatusPurpose } from './types';

export interface EvaluateStatusOptions {
  encodedList: string;
  statusListIndex: string | number;
  statusPurpose: StatusPurpose;
  statusSize?: number;
  statusMessages?: StatusMessage[];
  minimumEntries?: number;
}

export interface StatusEvaluation {
  status: number;
  valid: boolean;
  purpose: StatusPurpose;
  message?: string;
}

export function evaluateStatus(options: EvaluateStatusOptions): StatusEvaluation {
  const index = parseStatusListIndex(options.statusListIndex);
  const statusSize = options.statusSize ?? 1;

  const list = BitstringStatusList.fromEncoded(options.encodedList, {
    statusSize,
    minimumEntries: options.minimumEntries,
  });

  const statusValue = list.getEntry(index);
  const evaluation: StatusEvaluation = {
    status: statusValue,
    valid: statusValue === 0,
    purpose: options.statusPurpose,
  };

  if (options.statusPurpose === 'message' && options.statusMessages?.length) {
    evaluation.message = mapStatusMessage(statusValue, options.statusMessages);
  }

  return evaluation;
}

function parseStatusListIndex(value: string | number): number {
  if (typeof value === 'number') {
    if (!Number.isInteger(value) || value < 0) {
      throw new StatusListError('MALFORMED_VALUE_ERROR', 'statusListIndex must be a non-negative integer.');
    }
    return value;
  }

  if (!value) {
    throw new StatusListError('MALFORMED_VALUE_ERROR', 'statusListIndex is required.');
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || Number.isNaN(parsed) || parsed < 0) {
    throw new StatusListError('MALFORMED_VALUE_ERROR', 'statusListIndex must be a non-negative integer string.');
  }
  return parsed;
}

function mapStatusMessage(status: number, messages: StatusMessage[]): string | undefined {
  for (const item of messages) {
    try {
      const descriptor = parseStatusMessageIdentifier(item.status);
      if (descriptor === status) {
        return item.message;
      }
    } catch (error) {
      // Ignore malformed entries and continue searching. They will be surfaced
      // when referenced by callers.
    }
  }
  return undefined;
}

function parseStatusMessageIdentifier(value: string): number {
  if (value.startsWith('0x') || value.startsWith('0X')) {
    const parsedHex = Number.parseInt(value.slice(2), 16);
    if (Number.isFinite(parsedHex) && !Number.isNaN(parsedHex) && parsedHex >= 0) {
      return parsedHex;
    }
  }

  const parsedDecimal = Number.parseInt(value, 10);
  if (Number.isFinite(parsedDecimal) && !Number.isNaN(parsedDecimal) && parsedDecimal >= 0) {
    return parsedDecimal;
  }

  throw new StatusListError('MALFORMED_VALUE_ERROR', `Invalid status message identifier: ${value}`);
}
