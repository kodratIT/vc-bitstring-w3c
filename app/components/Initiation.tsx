'use client';

import { useEffect, useState } from 'react';
import JsonView from '@/app/components/JsonView';

type StatusMessage = { status: string; message: string };

type SummaryResponse = {
  credentialId?: string;
  statusPurpose: string;
  entryCount: number;
  statusSize: number;
  encodedListLength: number;
  encodedList: string;
  flaggedCount: number;
  flaggedSamples: number[];
  statusMessages: StatusMessage[];
  statusListCredential: Record<string, unknown>;
};

export default function Initiation(): JSX.Element {
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    setLoading(true);
    fetch('/api/state')
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.message ?? 'Gagal memuat ringkasan inisiasi.');
        }
        return res.json();
      })
      .then((json: SummaryResponse) => {
        setSummary(json);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Kesalahan tidak diketahui.');
      })
      .finally(() => setLoading(false));
  }, []);

  const subject = summary?.statusListCredential?.['credentialSubject'] as
    | {
        statusPurpose?: string;
        statusSize?: number;
        encodedList?: string;
        statusMessages?: StatusMessage[];
        id?: string;
      }
    | undefined;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="card">
        <h3 className="mb-2">Inisiasi Bitstring Status List</h3>
        {loading && <p className="muted">Memuat...</p>}
        {error && <p className="error">{error}</p>}
        {summary && (
          <ul className="summary">
            <li>
              <strong>Credential ID:</strong> {summary.credentialId ?? '—'}
            </li>
            <li>
              <strong>Issuer:</strong>{' '}
              {String(summary.statusListCredential?.['issuer'] ?? 'did:example:issuer')}
            </li>
            <li>
              <strong>Status Purpose:</strong> {String(subject?.statusPurpose ?? summary.statusPurpose)}
            </li>
            <li>
              <strong>Entry Count:</strong> {summary.entryCount.toLocaleString()}
            </li>
            <li>
              <strong>Status Size:</strong> {summary.statusSize} bit/entry
            </li>
            <li>
              <strong>List Subject ID:</strong> {String(subject?.id ?? '—')}
            </li>
            <li>
              <strong>encodedList length:</strong> {summary.encodedListLength} karakter
            </li>
            <li>
              <strong>Flagged:</strong> {summary.flaggedCount} indeks
              {summary.flaggedCount > 0 && (
                <> (contoh: {summary.flaggedSamples.slice(0, 10).join(', ') || 'n/a'})</>
              )}
            </li>
            {Array.isArray(subject?.statusMessages) && subject!.statusMessages!.length > 0 && (
              <li>
                <strong>Status Messages:</strong>{' '}
                {subject!.statusMessages!.map((m) => `${m.status}:${m.message}`).join(', ')}
              </li>
            )}
          </ul>
        )}
      </div>

      <div className="card">
        <h3 className="mb-2">Status List Credential</h3>
        <JsonView data={summary?.statusListCredential} />
      </div>
    </div>
  );
}