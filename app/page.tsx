'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import JsonView from '@/app/components/JsonView';
import CryptoFlow from '@/app/components/CryptoFlow';
import Initiation from '@/app/components/Initiation';
import BitGrid from '@/app/components/BitGrid';

type StatusPurpose = 'revocation' | 'suspension' | 'message' | string;

type StatusMessage = {
  status: string;
  message: string;
};

type StatusEvaluation = {
  status: number;
  valid: boolean;
  purpose: StatusPurpose;
  message?: string;
};

type SimulationStep = {
  timestamp: string;
  evaluation: StatusEvaluation;
};

type SimulationRevocation = SimulationStep & {
  reason?: string;
};

type SimulationState = {
  credential?: Record<string, unknown>;
  statusListIndex?: number;
  credentialIssuedAt?: string;
  holderCheck?: SimulationStep;
  verifierCheck?: SimulationStep;
  revocation?: SimulationRevocation;
};

type StatusEvent = {
  id: number;
  timestamp: string;
  type: 'reset' | 'update' | 'evaluate' | 'info';
  message: string;
  details?: Record<string, unknown>;
};

type SummaryResponse = {
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
  simulation: SimulationState;
  events: StatusEvent[];
};

type StatusCheckResult = StatusEvaluation & {
  index: number;
  timestamp?: string;
};

const DEFAULT_STATUS_MESSAGES = JSON.stringify(
  [
    { status: '0x0', message: 'pending_review' },
    { status: '0x1', message: 'accepted' },
    { status: '0x2', message: 'rejected' },
  ],
  null,
  2
);

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE ?? '').replace(/\/?$/, '');
const apiUrl = (path: string) => `${API_BASE}${path}`;

export const dynamic = 'force-dynamic';


function formatTimestamp(value?: string): string {
  if (!value) {
    return '—';
  }
  return new Date(value).toLocaleString();
}

export default function HomePage(): JSX.Element {
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [statusPurpose, setStatusPurpose] = useState<StatusPurpose>('revocation');
  const [statusMessagesInput, setStatusMessagesInput] = useState(DEFAULT_STATUS_MESSAGES);

  const [holderId, setHolderId] = useState('did:example:holder');
  const [holderName, setHolderName] = useState('Alice Holder');
  const [revokeReason, setRevokeReason] = useState('');

  const [statusIndex, setStatusIndex] = useState('');
  const [statusResult, setStatusResult] = useState<StatusCheckResult | null>(null);
  const [updateIndex, setUpdateIndex] = useState('');
  const [updateValue, setUpdateValue] = useState('1');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const statusMessageOptions = useMemo(() => {
    if (statusPurpose !== 'message') {
      return null;
    }
    try {
      const parsed = JSON.parse(statusMessagesInput) as StatusMessage[];
      if (!Array.isArray(parsed) || parsed.length === 0) {
        return [];
      }
      return parsed;
    } catch {
      return [];
    }
  }, [statusMessagesInput, statusPurpose]);

  const flaggedDisplay = useMemo(() => {
    if (!summary) {
      return '–';
    }
    if (summary.flaggedCount === 0) {
      return 'Tidak ada indeks dengan status tidak valid.';
    }
    const sample = summary.flaggedSamples.slice(0, 10).join(', ');
    return `${summary.flaggedCount} indeks tidak valid (contoh: ${sample || 'n/a'})`;
  }, [summary]);

  const eventLog = summary?.events ?? [];
  const simulation = summary?.simulation;

  const fetchSummary = useCallback(async () => {
    console.log('UI - Starting fetchSummary');
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(apiUrl('/api/state'));
      if (!response.ok) {
        throw new Error('Gagal memuat ringkasan status.');
      }
      const data = (await response.json()) as SummaryResponse;
      console.log('UI - API /api/state response received:', data);
      setSummary(data);
      console.log('UI - Set summary, simulation credential loaded:', !!data.simulation?.credential);
      setStatusPurpose(data.statusPurpose);
      if (data.statusPurpose === 'message') {
        const serialized = JSON.stringify(data.statusMessages ?? [], null, 2);
        setStatusMessagesInput(serialized === '[]' ? DEFAULT_STATUS_MESSAGES : serialized);
        if (data.statusMessages.length > 0) {
          const first = data.statusMessages[0].status;
          const numeric = first.startsWith('0x') ? parseInt(first, 16) : Number.parseInt(first, 10);
          if (Number.isFinite(numeric)) {
            setUpdateValue(numeric.toString());
          }
        }
      } else {
        setUpdateValue('1');
      }
    } catch (err) {
      console.error('UI - fetchSummary error:', err);
      setError(err instanceof Error ? err.message : 'Kesalahan tidak diketahui.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    console.log('UI - Initial useEffect calling fetchSummary');
    fetchSummary().catch(() => {
      /* handled */
    });
  }, [fetchSummary]);

  useEffect(() => {
    if (statusPurpose !== 'message') {
      setStatusMessagesInput(DEFAULT_STATUS_MESSAGES);
    }
  }, [statusPurpose]);

  const resetStatusList = useCallback(async () => {
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      let parsedMessages: StatusMessage[] | undefined;
      if (statusPurpose === 'message') {
        try {
          parsedMessages = JSON.parse(statusMessagesInput) as StatusMessage[];
          if (!Array.isArray(parsedMessages) || parsedMessages.length === 0) {
            throw new Error('statusMessages harus berupa array dengan minimal satu entri.');
          }
        } catch (err) {
          throw new Error(
            err instanceof Error ? `statusMessages tidak valid: ${err.message}` : 'statusMessages tidak valid.'
          );
        }
      }

      const response = await fetch(apiUrl('/api/reset'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statusPurpose, statusMessages: parsedMessages }),
      });
      if (!response.ok) {
        const problem = await response.json();
        throw new Error(problem?.message ?? 'Gagal mereset status list.');
      }
      setInfo('Status list diinisialisasi ulang.');
      setStatusIndex('');
      setUpdateIndex('');
      setStatusResult(null);
      setRevokeReason('');
      await fetchSummary();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kesalahan tidak diketahui.');
    } finally {
      setLoading(false);
    }
  }, [fetchSummary, statusPurpose, statusMessagesInput]);

  const issueCredential = useCallback(async () => {
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const response = await fetch(apiUrl('/api/simulate/issue'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ holderId, subjectName: holderName }),
      });
      if (!response.ok) {
        const problem = await response.json();
        throw new Error(problem?.message ?? 'Gagal menerbitkan credential.');
      }
      setInfo('Credential berhasil diterbitkan dan diberikan ke holder.');
      await fetchSummary();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kesalahan tidak diketahui.');
    } finally {
      setLoading(false);
    }
  }, [fetchSummary, holderId, holderName]);

  const holderCheck = useCallback(async () => {
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const response = await fetch(apiUrl('/api/simulate/holder-check'), { method: 'POST' });
      if (!response.ok) {
        const problem = await response.json();
        throw new Error(problem?.message ?? 'Holder gagal mengecek status.');
      }
      setInfo('Holder berhasil mengecek status credential.');
      await fetchSummary();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kesalahan tidak diketahui.');
    } finally {
      setLoading(false);
    }
  }, [fetchSummary]);

  const verifierCheck = useCallback(async () => {
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const response = await fetch(apiUrl('/api/simulate/verify'), { method: 'POST' });
      if (!response.ok) {
        const problem = await response.json();
        throw new Error(problem?.message ?? 'Verifier gagal memvalidasi credential.');
      }
      setInfo('Verifier telah memverifikasi credential.');
      await fetchSummary();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kesalahan tidak diketahui.');
    } finally {
      setLoading(false);
    }
  }, [fetchSummary]);

  const revokeCredential = useCallback(async () => {
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const response = await fetch(apiUrl('/api/simulate/revoke'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: revokeReason || undefined }),
      });
      if (!response.ok) {
        const problem = await response.json();
        throw new Error(problem?.message ?? 'Gagal mencabut credential.');
      }
      setInfo('Credential dicabut. Status list diperbarui.');
      await fetchSummary();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kesalahan tidak diketahui.');
    } finally {
      setLoading(false);
    }
  }, [fetchSummary, revokeReason]);

  const submitUpdate = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setInfo(null);
      setError(null);
      setStatusResult(null);

      const index = Number.parseInt(updateIndex, 10);
      const value = Number.parseInt(updateValue, 10);
      if (!Number.isInteger(index) || index < 0) {
        setError('Indeks harus bilangan bulat non-negatif.');
        return;
      }
      if (!Number.isInteger(value) || value < 0) {
        setError('Nilai status harus bilangan bulat non-negatif.');
        return;
      }

      setLoading(true);
      try {
        const response = await fetch(apiUrl('/api/update'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updates: [{ index, value }] }),
        });
        if (!response.ok) {
          const problem = await response.json();
          throw new Error(problem?.message ?? 'Gagal memperbarui status.');
        }
        setInfo(`Index ${index} diperbarui menjadi ${value}.`);
        await fetchSummary();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Kesalahan tidak diketahui.');
      } finally {
        setLoading(false);
      }
    },
    [fetchSummary, updateIndex, updateValue]
  );

  const checkStatus = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setInfo(null);
      setError(null);

      const index = Number.parseInt(statusIndex, 10);
      if (!Number.isInteger(index) || index < 0) {
        setError('Indeks harus bilangan bulat non-negatif.');
        return;
      }

      setLoading(true);
      try {
        const response = await fetch(apiUrl(`/api/status/${index}`));
        if (!response.ok) {
          const problem = await response.json();
          throw new Error(problem?.message ?? 'Gagal mengambil status.');
        }
        const data = (await response.json()) as StatusCheckResult;
        setStatusResult({ ...data, timestamp: new Date().toISOString() });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Kesalahan tidak diketahui.');
      } finally {
        setLoading(false);
      }
    },
    [statusIndex]
  );

  return (
    <main className="container">
      <header id="overview">
        <h1>Simulasi VC Bitstring Status List</h1>
        <p>
          Visualisasi end-to-end dari penerbitan credential, holder checking, verifikasi oleh verifier, hingga pencabutan
          credential sesuai spesifikasi W3C VC Bitstring Status List.
        </p>
      </header>

      <section className="card">
        <h2>Ringkasan Status List</h2>
        {loading && <p className="muted">Memuat...</p>}
        {summary ? (
          <ul className="summary">
            <li>
              <strong>Credential ID:</strong> {summary.credentialId ?? '—'}
            </li>
            <li>
              <strong>Status Purpose:</strong> {summary.statusPurpose}
            </li>
            <li>
              <strong>Entry Count:</strong> {summary.entryCount.toLocaleString()}
            </li>
            <li>
              <strong>Status Size:</strong> {summary.statusSize} bit
            </li>
            <li>
              <strong>encodedList length:</strong> {summary.encodedListLength} karakter
            </li>
            <li>
              <strong>Flagged:</strong> {flaggedDisplay}
            </li>
          </ul>
        ) : (
          <p className="muted">Belum ada data ringkasan.</p>
        )}
        <button type="button" onClick={fetchSummary} disabled={loading}>
          Muat ulang ringkasan
        </button>
      </section>

      <section id="crypto" className="card">
        <h2>Cryptography Pipeline</h2>
        <CryptoFlow />
      </section>

      <section id="initiation" className="card">
        <h2>Konfigurasi Status List</h2>
        <div className="reset-form">
          <label htmlFor="purpose">Status Purpose</label>
          <select
            id="purpose"
            value={statusPurpose}
            onChange={(event) => setStatusPurpose(event.target.value)}
            disabled={loading}
          >
            <option value="revocation">revocation</option>
            <option value="suspension">suspension</option>
            <option value="message">message</option>
          </select>
          {statusPurpose === 'message' && (
            <>
              <label className="textarea-label" htmlFor="statusMessages">
                Status Messages (JSON)
              </label>
              <textarea
                id="statusMessages"
                value={statusMessagesInput}
                onChange={(event) => setStatusMessagesInput(event.target.value)}
                rows={6}
                placeholder={DEFAULT_STATUS_MESSAGES}
              />
            </>
          )}
          <button type="button" onClick={resetStatusList} disabled={loading}>
            Reset Status List
          </button>
        </div>
      </section>

      <section id="initiation-details" className="card">
        <h2>Bitstring Initiation</h2>
        <Initiation />
      </section>

      <section id="bitgrid" className="card">
        <h2>Bitstring Grid</h2>
        <BitGrid />
      </section>

      <section className="card">
        <h2>Langkah 1 – Issuer Menerbitkan Credential</h2>
        <div className="step-grid">
          <div className="form-grid">
            <label htmlFor="holderId">Holder ID</label>
            <input
              id="holderId"
              value={holderId}
              onChange={(event) => setHolderId(event.target.value)}
              placeholder="did:example:holder"
            />

            <label htmlFor="holderName">Nama Holder</label>
            <input
              id="holderName"
              value={holderName}
              onChange={(event) => setHolderName(event.target.value)}
              placeholder="Alice Holder"
            />

            <button type="button" onClick={issueCredential} disabled={loading}>
              Terbitkan Credential
            </button>
          </div>
          <div>
            <h3>Credential Terakhir</h3>
            <p className="muted">Diterbitkan: {formatTimestamp(simulation?.credentialIssuedAt)}</p>
            <JsonView data={simulation?.credential} />
          </div>
        </div>
      </section>

      <section className="card">
        <h2>Langkah 2 – Holder Mengecek Status</h2>
        <div className="step-grid">
          <div className="form-grid">
            <button type="button" onClick={holderCheck} disabled={loading}>
              Holder Cek Status
            </button>
          </div>
          <div>
            <h3>Hasil Holder</h3>
            <p className="muted">
              Terakhir dicek: {formatTimestamp(simulation?.holderCheck?.timestamp)}
            </p>
            {simulation?.holderCheck ? (
              <ul className="status-summary">
                <li>
                  Status: <strong>{simulation.holderCheck.evaluation.status}</strong>
                </li>
                <li>
                  Valid: <strong>{simulation.holderCheck.evaluation.valid ? 'Ya' : 'Tidak'}</strong>
                </li>
                {simulation.holderCheck.evaluation.message && (
                  <li>Pesan: {simulation.holderCheck.evaluation.message}</li>
                )}
              </ul>
            ) : (
              <p className="muted">Belum ada pengecekan oleh holder.</p>
            )}
          </div>
        </div>
      </section>

      <section className="card">
        <h2>Langkah 3 – Verifier Memvalidasi</h2>
        <div className="step-grid">
          <div className="form-grid">
            <button type="button" onClick={verifierCheck} disabled={loading}>
              Verifier Verifikasi
            </button>
          </div>
          <div>
            <h3>Hasil Verifikasi</h3>
            <p className="muted">
              Terakhir diverifikasi: {formatTimestamp(simulation?.verifierCheck?.timestamp)}
            </p>
            {simulation?.verifierCheck ? (
              <ul className="status-summary">
                <li>
                  Status: <strong>{simulation.verifierCheck.evaluation.status}</strong>
                </li>
                <li>
                  Valid: <strong>{simulation.verifierCheck.evaluation.valid ? 'Ya' : 'Tidak'}</strong>
                </li>
                {simulation.verifierCheck.evaluation.message && (
                  <li>Pesan: {simulation.verifierCheck.evaluation.message}</li>
                )}
              </ul>
            ) : (
              <p className="muted">Belum ada verifikasi.</p>
            )}
          </div>
        </div>
      </section>

      <section className="card">
        <h2>Langkah 4 – Pencabutan oleh Issuer</h2>
        <div className="step-grid">
          <div className="form-grid">
            <label htmlFor="revokeReason">Alasan Pencabutan (opsional)</label>
            <input
              id="revokeReason"
              value={revokeReason}
              onChange={(event) => setRevokeReason(event.target.value)}
              placeholder="Misal: Pelanggaran kebijakan"
            />
            <button type="button" onClick={revokeCredential} disabled={loading}>
              Cabut Credential
            </button>
          </div>
          <div>
            <h3>Status Setelah Pencabutan</h3>
            <p className="muted">
              Dicabut: {formatTimestamp(simulation?.revocation?.timestamp)}
            </p>
            {simulation?.revocation ? (
              <ul className="status-summary">
                <li>
                  Status: <strong>{simulation.revocation.evaluation.status}</strong>
                </li>
                <li>
                  Valid: <strong>{simulation.revocation.evaluation.valid ? 'Ya' : 'Tidak'}</strong>
                </li>
                {simulation.revocation.reason && <li>Alasan: {simulation.revocation.reason}</li>}
                {simulation.revocation.evaluation.message && (
                  <li>Pesan: {simulation.revocation.evaluation.message}</li>
                )}
              </ul>
            ) : (
              <p className="muted">Belum ada pencabutan.</p>
            )}
          </div>
        </div>
      </section>

      <section id="manual" className="card">
        <h2>Eksperimen Manual</h2>
        <div className="manual-grid">
          <form onSubmit={submitUpdate} className="form-grid">
            <h3>Perbarui Status secara Manual</h3>
            <label htmlFor="updateIndex">Indeks</label>
            <input
              id="updateIndex"
              type="number"
              min="0"
              value={updateIndex}
              onChange={(event) => setUpdateIndex(event.target.value)}
              placeholder="Misal 42"
              required
            />

            <label htmlFor="updateValue">Nilai</label>
            <select
              id="updateValue"
              value={updateValue}
              onChange={(event) => setUpdateValue(event.target.value)}
            >
              {statusPurpose === 'message'
                ? (statusMessageOptions ?? []).map((entry) => {
                    const numeric = entry.status.startsWith('0x')
                      ? parseInt(entry.status, 16)
                      : Number.parseInt(entry.status, 10);
                    return (
                      <option key={entry.status} value={numeric.toString()}>
                        {numeric} – {entry.message}
                      </option>
                    );
                  })
                : [
                    <option key="1" value="1">
                      1 – Tidak valid / revoked
                    </option>,
                    <option key="0" value="0">
                      0 – Valid
                    </option>,
                  ]}
            </select>

            <button type="submit" disabled={loading}>
              Terapkan Update
            </button>
          </form>

          <form onSubmit={checkStatus} className="form-grid">
            <h3>Cek Status berdasarkan Indeks</h3>
            <label htmlFor="statusIndex">Indeks</label>
            <input
              id="statusIndex"
              type="number"
              min="0"
              value={statusIndex}
              onChange={(event) => setStatusIndex(event.target.value)}
              placeholder="Misal 42"
              required
            />
            <button type="submit" disabled={loading}>
              Cek Status
            </button>
            {statusResult && (
              <div className="status-output">
                <p>
                  Index <strong>{statusResult.index}</strong> → status <strong>{statusResult.status}</strong>{' '}
                  ({statusResult.valid ? 'VALID' : 'TIDAK VALID'})
                </p>
                <p className="muted">Waktu cek: {formatTimestamp(statusResult.timestamp)}</p>
                {statusResult.message && <p>Pesan: {statusResult.message}</p>}
              </div>
            )}
          </form>
        </div>
      </section>

      <section className="card">
        <h2>Status List Credential JSON</h2>
        <JsonView data={summary?.statusListCredential} />
      </section>

      <section id="timeline" className="card">
        <h2>Log Proses</h2>
        {eventLog.length === 0 ? (
          <p className="muted">Belum ada aktivitas yang terekam.</p>
        ) : (
          <ul className="event-log">
            {eventLog.map((event) => (
              <li key={event.id} className={`event-item event-${event.type}`}>
                <div className="event-header">
                  <span className="event-type">{event.type.toUpperCase()}</span>
                  <time dateTime={event.timestamp}>{new Date(event.timestamp).toLocaleString()}</time>
                </div>
                <p className="event-message">{event.message}</p>
                {event.details && (
                  <details>
                    <summary>Lihat detail</summary>
                    <pre>{JSON.stringify(event.details, null, 2)}</pre>
                  </details>
                )}
              </li>
            ))}
          </ul>
        )}
        <button type="button" onClick={fetchSummary} disabled={loading}>
          Muat ulang log
        </button>
      </section>

      {(error || info) && (
        <section className="card feedback">
          {error && <p className="error">{error}</p>}
          {info && <p className="success">{info}</p>}
        </section>
      )}

      <footer>
        <p>
          Jalankan aplikasi dengan <code>npm run dev</code>. Atur <code>NEXT_PUBLIC_API_BASE</code> bila backend dipisah dari
          Next.js server.
        </p>
      </footer>
    </main>
  );
}
