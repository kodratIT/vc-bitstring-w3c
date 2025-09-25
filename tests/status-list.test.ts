import { describe, expect, it } from 'vitest';

import {
  BitstringStatusList,
  MINIMUM_ENTRY_COUNT,
  applyStatusUpdates,
  createStatusListCredential,
  evaluateStatus,
  syncEncodedList,
} from '../src/index';

const REVOCATION_INDEX = 42_424;

describe('BitstringStatusList', () => {
  it('encodes and decodes round trip', () => {
    const list = new BitstringStatusList();
    list.setEntry(REVOCATION_INDEX, 1);

    const encoded = list.encode();
    expect(encoded.startsWith('u')).toBe(true);

    const decoded = BitstringStatusList.fromEncoded(encoded);
    expect(decoded.getEntry(REVOCATION_INDEX)).toBe(1);
    expect(decoded.entryCount).toBeGreaterThanOrEqual(MINIMUM_ENTRY_COUNT);
  });

  it('enforces range checks when updating entries', () => {
    const list = new BitstringStatusList();
    expect(() => list.setEntry(-1, 1)).toThrowError('Index');
    expect(() => list.setEntry(list.entryCount, 1)).toThrowError('Index');
    expect(() => list.setEntry(0, 4)).toThrowError('Status value');
  });
});

describe('Status list credential helpers', () => {
  it('creates a credential with default context', () => {
    const { credential } = createStatusListCredential({
      issuer: 'did:example:issuer',
      statusPurpose: 'revocation',
      id: 'https://example.com/credentials/status/3',
      listId: 'https://example.com/credentials/status/3#list',
      validFrom: '2024-01-01T00:00:00Z',
    });

    expect(credential['@context']).toContain('https://www.w3.org/ns/credentials/v2');
    expect(credential.type).toContain('VerifiableCredential');
    expect(credential.type).toContain('BitstringStatusListCredential');
    expect(credential.credentialSubject.encodedList.startsWith('u')).toBe(true);
  });

  it('supports multi-bit message purpose lists', () => {
    const messages = [
      { status: '0x0', message: 'pending_review' },
      { status: '0x1', message: 'accepted' },
      { status: '0x2', message: 'rejected' },
    ];

    const { credential, list } = createStatusListCredential({
      issuer: 'did:example:issuer',
      statusPurpose: 'message',
      statusMessages: messages,
    });

    list.setEntry(10, 2);
    syncEncodedList(credential, list);

    const evaluation = evaluateStatus({
      encodedList: credential.credentialSubject.encodedList,
      statusListIndex: '10',
      statusPurpose: credential.credentialSubject.statusPurpose,
      statusSize: credential.credentialSubject.statusSize,
      statusMessages: credential.credentialSubject.statusMessages,
    });

    expect(evaluation.status).toBe(2);
    expect(evaluation.valid).toBe(false);
    expect(evaluation.message).toBe('rejected');
  });
});

describe('applyStatusUpdates', () => {
  it('applies batch updates', () => {
    const { list } = createStatusListCredential({
      issuer: 'did:example:issuer',
      statusPurpose: 'revocation',
    });

    applyStatusUpdates(list, [
      { index: 1, value: 1 },
      { index: 2, value: 1 },
    ]);

    expect(list.getEntry(1)).toBe(1);
    expect(list.getEntry(2)).toBe(1);
  });
});
