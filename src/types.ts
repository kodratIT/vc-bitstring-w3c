export type StatusPurpose = 'revocation' | 'suspension' | 'message' | string;

export interface StatusMessage {
  status: string;
  message: string;
}

export interface BitstringStatusListSubject {
  id?: string;
  type: 'BitstringStatusList';
  statusPurpose: StatusPurpose;
  encodedList: string;
  statusSize?: number;
  statusMessages?: StatusMessage[];
  statusReference?: string;
  ttl?: number;
}

export interface BitstringStatusListCredential {
  '@context': (string | Record<string, unknown>)[];
  id?: string;
  type: string[];
  issuer: string | Record<string, unknown>;
  validFrom?: string;
  validUntil?: string;
  credentialSubject: BitstringStatusListSubject;
  [key: string]: unknown;
}

export interface BitstringStatusListEntry {
  id: string;
  type: 'BitstringStatusListEntry';
  statusPurpose: StatusPurpose;
  statusListIndex: string;
  statusListCredential: string;
  statusSize?: number;
  statusMessage?: StatusMessage[];
  statusReference?: string;
  [key: string]: unknown;
}
