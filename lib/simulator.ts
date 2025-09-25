import { randomUUID } from 'node:crypto';

import {
  BitstringStatusList,
  StatusListError,
  applyStatusUpdates,
  createStatusListCredential,
  evaluateStatus,
  syncEncodedList,
  decodeBitstring,
} from '@/src/index';
import type { StatusEvaluation } from '@/src/index';
import type { StatusMessage, StatusPurpose, BitstringStatusListCredential } from '@/src/types';
import { kv } from '@vercel/kv';

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

interface SerializedAppState {
  credential: Record<string, unknown>;
  flaggedIndices: number[];
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

interface SimulatorStore {
  state: AppState;
  events: StatusEvent[];
  eventCounter: number;
  nextCredentialIndex: number;
}

interface SerializedStore {
  state: SerializedAppState;
  events: StatusEvent[];
  eventCounter: number;
  nextCredentialIndex: number;
}

const DEFAULT_STATUS_MESSAGES: StatusMessage[] = [
  { status: '0x0', message: 'pending_review' },
  { status: '0x1', message: 'accepted' },
  { status: '0x2', message: 'rejected' },
];

const STATUS_LIST_ID = 'https://example.com/credentials/status-list';
const STATUS_LIST_LIST_ID = `${STATUS_LIST_ID}#list`;
const MAX_EVENTS = 200;
const KV_KEY = 'vc-bitstring-simulator';
const STORE_KEY = Symbol.for('vc-bitstring-simulator');

type GlobalSimulator = typeof globalThis & {
  [STORE_KEY]?: SimulatorStore;
};

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

function serializeAppState(state: AppState): SerializedAppState {
  return {
    credential: state.credential,
    flaggedIndices: Array.from(state.flaggedIndices),
    simulation: state.simulation,
  };
}

function serializeStore(store: SimulatorStore): SerializedStore {
  return {
    state: serializeAppState(store.state),
    events: store.events,
    eventCounter: store.eventCounter,
    nextCredentialIndex: store.nextCredentialIndex,
  };
}

function deserializeAppState(serialized: SerializedAppState): AppState {
  const credential: BitstringStatusListCredential = serialized.credential as BitstringStatusListCredential;
  const credentialSubject = credential.credentialSubject;
  const encodedBytes = decodeBitstring(credentialSubject.encodedList);
  const statusSize = credentialSubject.statusSize ?? 1;
  const entryCount = Math.floor((encodedBytes.length * 8) / statusSize);
  const list = new BitstringStatusList({
    source: encodedBytes,
    statusSize,
    entryCount,
  });
  return {
    list,
    credential,
    flaggedIndices: new Set(serialized.flaggedIndices),
    simulation: serialized.simulation,
  };
}

function deserializeStore(json: string): SimulatorStore {
  if (typeof json !== 'string') {
    throw new Error('Invalid KV data: expected string');
  }
  const obj: SerializedStore = JSON.parse(json);
  const state = deserializeAppState(obj.state);
  return {
    state,
    events: obj.events,
    eventCounter: obj.eventCounter,
    nextCredentialIndex: obj.nextCredentialIndex,
  };
}

async function getStore(): Promise<SimulatorStore> {
  const globalContext = globalThis as GlobalSimulator;
  if (globalContext[STORE_KEY]) {
    return globalContext[STORE_KEY]!;
  }

  const useKV = process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN;
  console.log('getStore - Using KV:', !!useKV);

  let store: SimulatorStore;
  if (useKV) {
    const json = await kv.get<string>(KV_KEY);
    if (json === null || typeof json !== 'string') {
      store = {
        state: createInitialState(),
        events: [],
        eventCounter: 0,
        nextCredentialIndex: 0,
      };
      await saveStore(store);
      logEvent(store, 'info', 'Simulator awal siap (KV reset due to invalid data).', { statusPurpose: store.state.credential.credentialSubject.statusPurpose });
      await saveStore(store);
    } else {
      try {
        store = deserializeStore(json);
      } catch (error) {
        console.error('Failed to deserialize KV store:', error);
        // Fallback to initial state
        store = {
          state: createInitialState(),
          events: [],
          eventCounter: 0,
          nextCredentialIndex: 0,
        };
        await saveStore(store);
        logEvent(store, 'info', 'Simulator awal siap (KV fallback due to parse error).', { statusPurpose: store.state.credential.credentialSubject.statusPurpose });
        await saveStore(store);
      }
    }
  } else {
    store = {
      state: createInitialState(),
      events: [],
      eventCounter: 0,
      nextCredentialIndex: 0,
    };
    logEvent(store, 'info', 'Simulator awal siap (in-memory mode).', { statusPurpose: store.state.credential.credentialSubject.statusPurpose });
  }

  globalContext[STORE_KEY] = store;
  return store;
}

async function saveStore(store: SimulatorStore): Promise<void> {
  const useKV = process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN;
  console.log('saveStore - Using KV:', !!useKV);
  if (!useKV) return;

  const serialized = JSON.stringify(serializeStore(store));
  await kv.set(KV_KEY, serialized);
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

export async function getSummary(): Promise<StatusSummary> {
  const store = await getStore();
  const { state } = store;
  console.log('getSummary - Simulation credential loaded:', !!state.simulation.credential);
  const credentialSubject = state.credential.credentialSubject;

  const result: StatusSummary = {
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
  return result;
}

export async function resetStatusList(options: { statusPurpose?: StatusPurpose; statusMessages?: unknown } = {}): Promise<{
  message: string;
  statusPurpose: StatusPurpose;
  statusMessages: StatusMessage[];
}> {
  const store = await getStore();
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
  await saveStore(store);

  return {
    message: 'Status list reset.',
    statusPurpose: store.state.credential.credentialSubject.statusPurpose,
    statusMessages: store.state.credential.credentialSubject.statusMessages ?? [],
  };
}

export async function updateStatusList(updates: { index: number; value: number }[]): Promise<{
  message: string;
  flaggedCount: number;
}> {
  const store = await getStore();
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
  await saveStore(store);

  return {
    message: 'Updates berhasil diterapkan.',
    flaggedCount: store.state.flaggedIndices.size,
  };
}

export async function checkStatus(index: number): Promise<{ index: number } & StatusEvaluation> {
  const store = await getStore();
  if (!Number.isInteger(index) || index < 0) {
    throw new StatusListError('MALFORMED_VALUE_ERROR', 'Index harus bilangan bulat non-negatif.');
  }
  const evaluation = evaluateIndex(store, index);
  logEvent(store, 'evaluate', `Verifier mengecek index ${index}.`, { ...evaluation });
  await saveStore(store);
  return { index, ...evaluation };
}

function getSimulationContext(store: SimulatorStore): { index: number; credential: Record<string, unknown> } {
  const { simulation } = store.state;
  if (!simulation.credential || simulation.statusListIndex === undefined) {
    throw new StatusListError('MALFORMED_VALUE_ERROR', 'Belum ada credential yang diterbitkan.');
  }
  return { credential: simulation.credential, index: simulation.statusListIndex };
}

export async function simulateIssuance(payload: { holderId?: string; subjectName?: string }): Promise<{
  credential: Record<string, unknown>;
  statusListIndex: number;
  issuedAt: string;
}> {
  const store = await getStore();
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
  await saveStore(store);

  return { credential, statusListIndex: index, issuedAt };
}

export async function simulateHolderCheck(): Promise<{
  timestamp: string;
  evaluation: StatusEvaluation;
  statusListIndex: number;
}> {
  const store = await getStore();
  const { index } = getSimulationContext(store);
  const evaluation = evaluateIndex(store, index);
  const timestamp = new Date().toISOString();

  store.state.simulation.holderCheck = { timestamp, evaluation };
  logEvent(store, 'evaluate', 'Holder memeriksa status credential.', { statusListIndex: index, ...evaluation });
  await saveStore(store);

  return { timestamp, evaluation, statusListIndex: index };
}

export async function simulateVerifierCheck(): Promise<{
  timestamp: string;
  evaluation: StatusEvaluation;
  statusListIndex: number;
}> {
  const store = await getStore();
  const { index } = getSimulationContext(store);
  const evaluation = evaluateIndex(store, index);
  const timestamp = new Date().toISOString();

  store.state.simulation.verifierCheck = { timestamp, evaluation };
  logEvent(store, 'evaluate', 'Verifier memvalidasi credential.', { statusListIndex: index, ...evaluation });
  await saveStore(store);

  return { timestamp, evaluation, statusListIndex: index };
}

export async function simulateRevocation(payload: { reason?: string }): Promise<{
  timestamp: string;
  evaluation: StatusEvaluation;
  statusListIndex: number;
  reason?: string;
}> {
  const store = await getStore();
  const { index } = getSimulationContext(store);
  const { reason } = payload;

  applyStatusUpdates(store.state.list, [{ index, value: 1 }]);
  store.state.flaggedIndices.add(index);
  syncEncodedList(store.state.credential, store.state.list);

  const evaluation = evaluateIndex(store, index);
  const timestamp = new Date().toISOString();

  store.state.simulation.revocation = { timestamp, reason, evaluation };
  logEvent(store, 'update', 'Issuer mencabut credential.', { statusListIndex: index, reason, ...evaluation });
  await saveStore(store);

  return { timestamp, evaluation, statusListIndex: index, reason };
}

export function normalizeStatusMessagesInput(input: unknown): StatusMessage[] | undefined {
  return normalizeStatusMessages(input);
}

/**
 * Return raw status values for a contiguous range without emitting log events.
 * Useful for UI visualization (BitGrid) to avoid polluting the timeline.
 */
export async function getStatusesRange(start: number, count: number): Promise<{ index: number; status: number }[]> {
  const store = await getStore();
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
