import { BitstringStatusList } from './bitstring';
import { StatusListError } from './errors';

export interface StatusUpdate {
  index: number;
  value: number;
}

export function applyStatusUpdates(list: BitstringStatusList, updates: StatusUpdate[]): void {
  if (!Array.isArray(updates)) {
    throw new StatusListError('MALFORMED_VALUE_ERROR', 'updates must be an array.');
  }

  for (const update of updates) {
    if (typeof update !== 'object' || update === null) {
      throw new StatusListError('MALFORMED_VALUE_ERROR', 'Each update must be an object.');
    }

    list.setEntry(update.index, update.value);
  }
}
