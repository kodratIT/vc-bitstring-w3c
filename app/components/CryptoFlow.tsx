'use client';

import { useEffect, useState } from 'react';
import JsonView from '@/app/components/JsonView';

type CryptoDetails = {
  prefix: string;
  prefixValid: boolean;
  encodedListLength: number;
  base64urlPayloadLength: number;
  compressedByteLength: number;
  uncompressedByteLength: number;
  compressionRatio: number;
  minimumRequiredUncompressedBytes: number;
  previewHex: string;
};

export default function CryptoFlow(): JSX.Element {
  const [details, setDetails] = useState<CryptoDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    setLoading(true);
    fetch('/api/crypto')
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.message ?? 'Gagal memuat detail kriptografi.');
        }
        return res.json();
      })
      .then((json: CryptoDetails) => {
        setDetails(json);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Kesalahan tidak diketahui.');
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="card">
        <h3 className="mb-2">Ringkasan Encoded List</h3>
        {loading && <p className="muted">Memuat...</p>}
        {error && <p className="error">{error}</p>}
        {details && (
          <ul className="summary">
            <li>
              <strong>Prefix:</strong> <span>{details.prefix}</span>{' '}
              <span className={details.prefixValid ? 'success' : 'error'}>
                ({details.prefixValid ? 'valid' : 'tidak valid'})
              </span>
            </li>
            <li>
              <strong>encodedList length:</strong> {details.encodedListLength} karakter
            </li>
            <li>
              <strong>payload length (base64url):</strong> {details.base64urlPayloadLength} karakter
            </li>
            <li>
              <strong>compressed bytes:</strong> {details.compressedByteLength.toLocaleString()} B
            </li>
            <li>
              <strong>uncompressed bytes:</strong> {details.uncompressedByteLength.toLocaleString()} B
            </li>
            <li>
              <strong>compression ratio:</strong> {details.compressionRatio.toFixed(3)}
            </li>
            <li>
              <strong>min required uncompressed:</strong>{' '}
              {details.minimumRequiredUncompressedBytes.toLocaleString()} B
            </li>
          </ul>
        )}
      </div>

      <div className="card">
        <h3 className="mb-2">Preview Uncompressed (hex)</h3>
        {details ? (
          <pre className="json-viewer">{details.previewHex || '—'}</pre>
        ) : (
          <p className="muted">Belum ada data.</p>
        )}
      </div>

      <div className="card md:col-span-2">
        <h3 className="mb-2">Raw Crypto Details</h3>
        <JsonView data={details ?? undefined} />
      </div>
    </div>
  );
}