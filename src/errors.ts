export type StatusListErrorCode =
  | 'STATUS_RETRIEVAL_ERROR'
  | 'STATUS_VERIFICATION_ERROR'
  | 'STATUS_LIST_LENGTH_ERROR'
  | 'MALFORMED_VALUE_ERROR'
  | 'RANGE_ERROR';

export const ERROR_URI_PREFIX =
  'https://www.w3.org/ns/credentials/status-list#';

export class StatusListError extends Error {
  readonly code: StatusListErrorCode;
  readonly uri: string;
  readonly cause?: unknown;

  constructor(code: StatusListErrorCode, message?: string, options?: { cause?: unknown }) {
    super(message ?? code);
    this.name = 'StatusListError';
    this.code = code;
    this.uri = `${ERROR_URI_PREFIX}${code}`;
    this.cause = options?.cause;
  }
}

export function assert(condition: unknown, code: StatusListErrorCode, message?: string): asserts condition {
  if (!condition) {
    throw new StatusListError(code, message);
  }
}
