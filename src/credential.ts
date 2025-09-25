import { BitstringStatusList } from './bitstring';
import { StatusListError } from './errors';
import {
  BitstringStatusListCredential,
  BitstringStatusListSubject,
  StatusMessage,
  StatusPurpose,
} from './types';

export interface CreateStatusListOptions {
  issuer: string | Record<string, unknown>;
  statusPurpose: StatusPurpose;
  id?: string;
  listId?: string;
  contexts?: (string | Record<string, unknown>)[];
  types?: string[];
  validFrom?: string;
  validUntil?: string;
  statusSize?: number;
  statusMessages?: StatusMessage[];
  statusReference?: string;
  ttl?: number;
  entryCount?: number;
  minimumEntries?: number;
  defaultEntryValue?: number;
}

export interface CreateStatusListResult {
  credential: BitstringStatusListCredential;
  list: BitstringStatusList;
}

export function createStatusListCredential(options: CreateStatusListOptions): CreateStatusListResult {
  const contexts = options.contexts ?? [
    'https://www.w3.org/ns/credentials/v2',
    'https://www.w3.org/ns/credentials/status/v1',
  ];
  const types = options.types ?? ['VerifiableCredential', 'BitstringStatusListCredential'];
  const inferredStatusSize = inferStatusSize(options.statusPurpose, options.statusSize, options.statusMessages);

  const list = new BitstringStatusList({
    entryCount: options.entryCount,
    statusSize: inferredStatusSize,
    minimumEntries: options.minimumEntries,
  });

  const defaultValue = options.defaultEntryValue ?? 0;
  if (defaultValue !== 0) {
    list.fill(defaultValue);
  }

  const encodedList = list.encode();

  const credentialSubject: BitstringStatusListSubject = {
    type: 'BitstringStatusList',
    statusPurpose: options.statusPurpose,
    encodedList,
  };

  if (options.listId) {
    credentialSubject.id = options.listId;
  }

  if (inferredStatusSize !== 1 || options.statusPurpose === 'message') {
    credentialSubject.statusSize = inferredStatusSize;
  }

  if (options.statusMessages?.length) {
    credentialSubject.statusMessages = options.statusMessages;
  }

  if (options.statusReference) {
    credentialSubject.statusReference = options.statusReference;
  }

  if (typeof options.ttl === 'number') {
    credentialSubject.ttl = options.ttl;
  }

  const credential: BitstringStatusListCredential = {
    '@context': contexts,
    type: types,
    issuer: options.issuer,
    credentialSubject,
  };

  if (options.id) {
    credential.id = options.id;
  }

  if (options.validFrom) {
    credential.validFrom = options.validFrom;
  }

  if (options.validUntil) {
    credential.validUntil = options.validUntil;
  }

  return { credential, list };
}

export function syncEncodedList(credential: BitstringStatusListCredential, list: BitstringStatusList): void {
  credential.credentialSubject.encodedList = list.encode();
}

function inferStatusSize(
  purpose: StatusPurpose,
  explicitSize: number | undefined,
  messages: StatusMessage[] | undefined
): number {
  if (explicitSize !== undefined) {
    if (!Number.isInteger(explicitSize) || explicitSize < 1) {
      throw new StatusListError('MALFORMED_VALUE_ERROR', 'statusSize must be a positive integer.');
    }
    return explicitSize;
  }

  if (purpose !== 'message') {
    return 1;
  }

  if (!messages || messages.length === 0) {
    throw new StatusListError('MALFORMED_VALUE_ERROR', 'statusMessages are required when statusPurpose is "message".');
  }

  let maxValue = 0;
  for (const item of messages) {
    const numericValue = parseStatusIdentifier(item.status);
    if (numericValue > maxValue) {
      maxValue = numericValue;
    }
  }

  const size = Math.max(1, Math.ceil(Math.log2(maxValue + 1)));
  if (!Number.isFinite(size) || Number.isNaN(size) || size < 1) {
    throw new StatusListError('MALFORMED_VALUE_ERROR', 'Unable to infer statusSize from statusMessages.');
  }
  return size;
}

function parseStatusIdentifier(value: string): number {
  if (!value) {
    throw new StatusListError('MALFORMED_VALUE_ERROR', 'status message identifier is required.');
  }

  if (value.startsWith('0x') || value.startsWith('0X')) {
    const parsedHex = Number.parseInt(value.slice(2), 16);
    if (Number.isInteger(parsedHex) && parsedHex >= 0) {
      return parsedHex;
    }
  }

  const parsedDecimal = Number.parseInt(value, 10);
  if (Number.isInteger(parsedDecimal) && parsedDecimal >= 0) {
    return parsedDecimal;
  }

  throw new StatusListError('MALFORMED_VALUE_ERROR', `Unrecognized status message identifier: ${value}`);
}
