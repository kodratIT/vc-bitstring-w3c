import { randomUUID } from 'node:crypto';

import {
  BitstringStatusList,
  StatusListError,
  applyStatusUpdates,
  createStatusListCredential,
  evaluateStatus,
  syncEncodedList,
} from '@/src/index';
import type { StatusEvaluation } from '@/src/index';
import type { StatusMessage, StatusPurpose } from '@/src/types';

interface SimulationRecord {
  credential?: Record<string, unknown>;
  statusListIndex?: number;
  credentialIssuedAt?: string;
  holderCheck?: SimulationStep;
  verifierCheck?: SimulationStep;
  revocation?: SimulationRevocation;
}

interface SimulationStep {
  timestamp: string;
  evaluation: StatusEvaluation;
}

interface SimulationRevocation extends SimulationStep {
  reason?: string;
}

interface AppState {
  list: BitstringStatusList;
  credential: ReturnType<typeof createStatusListCredential>['credential'];
  flaggedIndices: Set<number>;
  simulation: SimulationRecord;
}

interface InitializeOptions {
  statusPurpose?: StatusPurpose;
  defaultEntryValue?: number;
  statusMessages?: StatusMessage[];
}

export interface StatusEvent {
  id: number;
  timestamp: string;
  type: 'reset' | 'update' | 'evaluate' | 'info';
  message: string;
  details?: Record<string, unknown>;
}

export interface StatusSummary {
  credentialId?: string;
  statusPurpose: StatusPurpose;
  entryCount: number;
  statusSize: number;
  encodedListLength: number;
  encodedList: string;
  flaggedCount: number;
  flaggedSamples: number[];
  statusMessages: StatusMessage[];
  statusListCredential: Record<string, unknown>;
  simulation: SimulationRecord;
  events: StatusEvent[];
}

const DEFAULT_STATUS_MESSAGES: StatusMessage[] = [
  { status: '0x0', message: 'pending_review' },
  { status: '0x1', message: 'accepted' },
  { status: '0x2', message: 'rejected' },
];

const STATUS_LIST_ID = 'https://example.com/credentials/status-list';
const STATUS_LIST_LIST_ID = `${STATUS_LIST_ID}#list`;
const MAX_EVENTS = 200;

interface SimulatorStore {
  state: AppState;
  events: StatusEvent[];
  eventCounter: number;
  nextCredentialIndex: number;
}

const STORE_KEY = Symbol.for('vc-bitstring-simulator');

type GlobalSimulator = typeof globalThis & {
  [STORE_KEY]?: SimulatorStore;
};

function getStore(): SimulatorStore {
  const globalContext = globalThis as GlobalSimulator;
  if (!globalContext[STORE_KEY]) {
    const store: SimulatorStore = {
      state: createInitialState(),
      events: [],
      eventCounter: 0,
      nextCredentialIndex: 0,
    };
    globalContext[STORE_KEY] = store;
    logEvent(store, 'info', 'Simulator awal siap.', { statusPurpose: store.state.credential.credentialSubject.statusPurpose });
  }
  return globalContext[STORE_KEY]!;
}

function createInitialState(options: InitializeOptions = {}): AppState {
  const { statusPurpose = 'revocation', defaultEntryValue, statusMessages } = options;
  const resolvedMessages =
    statusPurpose === 'message'
      ? statusMessages && statusMessages.length > 0
        ? statusMessages
        : DEFAULT_STATUS_MESSAGES
      : undefined;

  const { credential, list } = createStatusListCredential({
    issuer: 'did:example:issuer',
    statusPurpose,
    defaultEntryValue,
    statusMessages: resolvedMessages,
    id: STATUS_LIST_ID,
    listId: STATUS_LIST_LIST_ID,
  });

  const flaggedIndices = new Set<number>();
  if (typeof defaultEntryValue === 'number' && defaultEntryValue > 0) {
    for (let index = 0; index < list.entryCount; index += 1) {
      flaggedIndices.add(index);
    }
  }

  return {
    list,
    credential,
    flaggedIndices,
    simulation: {},
  };
}

function logEvent(store: SimulatorStore, type: StatusEvent['type'], message: string, details?: Record<string, unknown>): void {
  const entry: StatusEvent = {
    id: ++store.eventCounter,
    timestamp: new Date().toISOString(),
    type,
    message,
    details,
  };
  store.events.push(entry);
  if (store.events.length > MAX_EVENTS) {
    store.events.shift();
  }
}

function normalizeStatusMessages(input: unknown): StatusMessage[] | undefined {
  if (input === undefined) {
    return undefined;
  }
  if (!Array.isArray(input)) {
    throw new StatusListError('MALFORMED_VALUE_ERROR', 'statusMessages harus berupa array.');
  }

  const normalized: StatusMessage[] = [];
  for (const entry of input) {
    if (typeof entry !== 'object' || entry === null) {
      throw new StatusListError('MALFORMED_VALUE_ERROR', 'Setiap statusMessages harus berupa objek.');
    }
    const { status, message } = entry as Partial<StatusMessage>;
    if (typeof status !== 'string' || typeof message !== 'string') {
      throw new StatusListError(
        'MALFORMED_VALUE_ERROR',
        'Setiap statusMessages membutuhkan properti string "status" dan "message".'
      );
    }
    normalized.push({ status, message });
  }
  return normalized;
}

function evaluateIndex(store: SimulatorStore, index: number): StatusEvaluation {
  return evaluateStatus({
    encodedList: store.state.credential.credentialSubject.encodedList,
    statusListIndex: index,
    statusPurpose: store.state.credential.credentialSubject.statusPurpose,
    statusSize: store.state.credential.credentialSubject.statusSize,
    statusMessages: store.state.credential.credentialSubject.statusMessages,
  });
}

export function getSummary(): StatusSummary {
  const store = getStore();
  const { state } = store;
  const credentialSubject = state.credential.credentialSubject;

  return {
    credentialId: state.credential.id,
    statusPurpose: credentialSubject.statusPurpose,
    entryCount: state.list.entryCount,
    statusSize: state.list.statusSize,
    encodedListLength: credentialSubject.encodedList.length,
    encodedList: credentialSubject.encodedList,
    flaggedCount: state.flaggedIndices.size,
    flaggedSamples: Array.from(state.flaggedIndices).slice(0, 20),
    statusMessages: credentialSubject.statusMessages ?? [],
    statusListCredential: state.credential,
    simulation: state.simulation,
    events: [...store.events].reverse().slice(0, 50),
  };
}

export function resetStatusList(options: { statusPurpose?: StatusPurpose; statusMessages?: unknown } = {}): {
  message: string;
  statusPurpose: StatusPurpose;
  statusMessages: StatusMessage[];
} {
  const store = getStore();
  const normalizedMessages = normalizeStatusMessages(options.statusMessages);

  store.state = createInitialState({
    statusPurpose: options.statusPurpose,
    statusMessages: normalizedMessages,
  });
  store.state.simulation = {};
  store.nextCredentialIndex = 0;

  logEvent(store, 'reset', 'Status list diinisialisasi ulang.', {
    statusPurpose: store.state.credential.credentialSubject.statusPurpose,
    statusMessages: store.state.credential.credentialSubject.statusMessages,
  });

  return {
    message: 'Status list reset.',
    statusPurpose: store.state.credential.credentialSubject.statusPurpose,
    statusMessages: store.state.credential.credentialSubject.statusMessages ?? [],
  };
}

export function updateStatusList(updates: { index: number; value: number }[]): {
  message: string;
  flaggedCount: number;
} {
  const store = getStore();
  if (!Array.isArray(updates) || updates.length === 0) {
    throw new StatusListError('MALFORMED_VALUE_ERROR', 'updates array dibutuhkan.');
  }

  applyStatusUpdates(store.state.list, updates);
  for (const { index, value } of updates) {
    if (value > 0) {
      store.state.flaggedIndices.add(index);
    } else {
      store.state.flaggedIndices.delete(index);
    }
  }
  syncEncodedList(store.state.credential, store.state.list);

  logEvent(store, 'update', `Menerapkan ${updates.length} pembaruan status.`, { updates });

  return {
    message: 'Updates berhasil diterapkan.',
    flaggedCount: store.state.flaggedIndices.size,
  };
}

export function checkStatus(index: number): { index: number } & StatusEvaluation {
  const store = getStore();
  if (!Number.isInteger(index) || index < 0) {
    throw new StatusListError('MALFORMED_VALUE_ERROR', 'Index harus bilangan bulat non-negatif.');
  }
  const evaluation = evaluateIndex(store, index);
  logEvent(store, 'evaluate', `Verifier mengecek index ${index}.`, { ...evaluation });
  return { index, ...evaluation };
}

function getSimulationContext(store: SimulatorStore): { index: number; credential: Record<string, unknown> } {
  const { simulation } = store.state;
  if (!simulation.credential || simulation.statusListIndex === undefined) {
    throw new StatusListError('MALFORMED_VALUE_ERROR', 'Belum ada credential yang diterbitkan.');
  }
  return { credential: simulation.credential, index: simulation.statusListIndex };
}

export function simulateIssuance(payload: { holderId?: string; subjectName?: string }): {
  credential: Record<string, unknown>;
  statusListIndex: number;
  issuedAt: string;
} {
  const store = getStore();
  const holderId = payload.holderId ?? 'did:example:holder';
  const subjectName = payload.subjectName ?? 'Alice Holder';

  const capacity = store.state.list.entryCount;
  let index = store.nextCredentialIndex;
  while (index < capacity) {
    const entryValue = store.state.list.getEntry(index);
    if (entryValue === 0 && !store.state.flaggedIndices.has(index)) {
      break;
    }
    index += 1;
  }

  if (index >= capacity) {
    throw new StatusListError('STATUS_LIST_LENGTH_ERROR', 'Tidak ada slot status yang tersedia untuk credential baru.');
  }

  store.nextCredentialIndex = index + 1;
  const issuedAt = new Date().toISOString();
  const statusListCredentialId = store.state.credential.id ?? STATUS_LIST_ID;

  const credential: Record<string, unknown> = {
    '@context': ['https://www.w3.org/ns/credentials/v2'],
    id: `https://example.com/credentials/${randomUUID()}`,
    type: ['VerifiableCredential', 'EmployeeCredential'],
    issuer: 'did:example:issuer',
    validFrom: issuedAt,
    credentialSubject: {
      id: holderId,
      name: subjectName,
    },
    credentialStatus: {
      id: `${statusListCredentialId}#${index}`,
      type: 'BitstringStatusListEntry',
      statusPurpose: store.state.credential.credentialSubject.statusPurpose,
      statusListIndex: index.toString(10),
      statusListCredential: statusListCredentialId,
    },
  };

  store.state.simulation = {
    credential,
    statusListIndex: index,
    credentialIssuedAt: issuedAt,
  };

  logEvent(store, 'info', 'Issuer menerbitkan credential baru.', {
    statusListIndex: index,
    holderId,
    subjectName,
  });

  return { credential, statusListIndex: index, issuedAt };
}

export function simulateHolderCheck(): {
  timestamp: string;
  evaluation: StatusEvaluation;
  statusListIndex: number;
} {
  const store = getStore();
  const { index } = getSimulationContext(store);
  const evaluation = evaluateIndex(store, index);
  const timestamp = new Date().toISOString();

  store.state.simulation.holderCheck = { timestamp, evaluation };
  logEvent(store, 'evaluate', 'Holder memeriksa status credential.', { statusListIndex: index, ...evaluation });

  return { timestamp, evaluation, statusListIndex: index };
}

export function simulateVerifierCheck(): {
  timestamp: string;
  evaluation: StatusEvaluation;
  statusListIndex: number;
} {
  const store = getStore();
  const { index } = getSimulationContext(store);
  const evaluation = evaluateIndex(store, index);
  const timestamp = new Date().toISOString();

  store.state.simulation.verifierCheck = { timestamp, evaluation };
  logEvent(store, 'evaluate', 'Verifier memvalidasi credential.', { statusListIndex: index, ...evaluation });

  return { timestamp, evaluation, statusListIndex: index };
}

export function simulateRevocation(payload: { reason?: string }): {
  timestamp: string;
  evaluation: StatusEvaluation;
  statusListIndex: number;
  reason?: string;
} {
  const store = getStore();
  const { index } = getSimulationContext(store);
  const { reason } = payload;

  applyStatusUpdates(store.state.list, [{ index, value: 1 }]);
  store.state.flaggedIndices.add(index);
  syncEncodedList(store.state.credential, store.state.list);

  const evaluation = evaluateIndex(store, index);
  const timestamp = new Date().toISOString();

  store.state.simulation.revocation = { timestamp, reason, evaluation };
  logEvent(store, 'update', 'Issuer mencabut credential.', { statusListIndex: index, reason, ...evaluation });

  return { timestamp, evaluation, statusListIndex: index, reason };
}

export function normalizeStatusMessagesInput(input: unknown): StatusMessage[] | undefined {
  return normalizeStatusMessages(input);
}

/**
 * Return raw status values for a contiguous range without emitting log events.
 * Useful for UI visualization (BitGrid) to avoid polluting the timeline.
 */
export function getStatusesRange(start: number, count: number): { index: number; status: number }[] {
  const store = getStore();
  if (!Number.isInteger(start) || start < 0) {
    throw new StatusListError('MALFORMED_VALUE_ERROR', 'start must be a non-negative integer.');
  }
  if (!Number.isInteger(count) || count < 1) {
    throw new StatusListError('MALFORMED_VALUE_ERROR', 'count must be a positive integer.');
  }
  const end = Math.min(start + count, store.state.list.entryCount);
  const result: { index: number; status: number }[] = [];
  for (let i = start; i < end; i += 1) {
    result.push({ index: i, status: store.state.list.getEntry(i) });
  }
  return result;
}
