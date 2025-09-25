'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type Entry = { index: number; status: number };

export default function BitGrid(): JSX.Element {
  const [start, setStart] = useState<number>(0);
  const [count, setCount] = useState<number>(256);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingIndex, setUpdatingIndex] = useState<number | null>(null);

  const columns = 32;
  const rows = useMemo(() => Math.ceil(count / columns), [count]);

  const fetchRange = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/status/range?start=${start}&count=${count}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message ?? 'Gagal memuat rentang bitstring.');
      }
      const json = (await res.json()) as Entry[];
      setEntries(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kesalahan tidak diketahui.');
    } finally {
      setLoading(false);
    }
  }, [start, count]);

  useEffect(() => {
    fetchRange().catch(() => {});
  }, [fetchRange]);

  const onToggle = useCallback(
    async (index: number, current: number) => {
      setUpdatingIndex(index);
      setError(null);
      try {
        const next = current === 0 ? 1 : 0;
        const res = await fetch('/api/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updates: [{ index, value: next }] }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.message ?? 'Gagal memperbarui status.');
        }
        await fetchRange();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Kesalahan tidak diketahui.');
      } finally {
        setUpdatingIndex(null);
      }
    },
    [fetchRange]
  );

  return (
    <div className="grid gap-4">
      <div className="card">
        <h3 className="mb-2">Rentang Bitstring</h3>
        <div className="form-grid">
          <label htmlFor="gridStart">Mulai (index)</label>
          <input
            id="gridStart"
            type="number"
            min={0}
            value={start}
            onChange={(e) => setStart(Number.parseInt(e.target.value || '0', 10))}
          />
          <label htmlFor="gridCount">Jumlah entri</label>
          <input
            id="gridCount"
            type="number"
            min={1}
            value={count}
            onChange={(e) => setCount(Number.parseInt(e.target.value || '1', 10))}
          />
          <button type="button" onClick={fetchRange} disabled={loading}>
            Muat Rentang
          </button>
        </div>
        {loading && <p className="muted">Memuat...</p>}
        {error && <p className="error">{error}</p>}
      </div>

      <div className="card">
        <h3 className="mb-2">Grid Status</h3>
        <div
          className="grid gap-1"
          style={{
            gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          }}
        >
          {Array.from({ length: rows * columns }).map((_, i) => {
            const entry = entries[i];
            const idx = (entry?.index ?? start + i);
            const val = entry?.status ?? 0;
            const isFlagged = val > 0;
            const isBusy = updatingIndex === idx;
            return (
              <button
                key={idx}
                type="button"
                aria-label={`index ${idx}, status ${val}`}
                className={`aspect-square rounded-md border text-xs flex items-center justify-center ${
                  isFlagged ? 'bg-red-500/60 border-red-300/40' : 'bg-green-500/40 border-green-300/40'
                } ${isBusy ? 'opacity-60' : ''}`}
                onClick={() => onToggle(idx, val)}
                title={`#${idx} → ${val}`}
              >
                {idx}
              </button>
            );
          })}
        </div>
        <p className="muted mt-2">
          Klik sel untuk toggle antara 0 (valid) dan 1 (tidak valid). Grid default 32 kolom × {rows} baris.
        </p>
      </div>
    </div>
  );
}