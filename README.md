# VC Bitstring Status List (Node.js)

Toolkit Node.js untuk membangun dan memvalidasi status list bitstring sesuai spesifikasi W3C [VC Bitstring Status List](https://www.w3.org/TR/vc-bitstring-status-list/).

## Fitur

- Utility `BitstringStatusList` untuk mengelola bitstring dengan ukuran minimum 16KB.
- Encoder/decoder multibase base64url dengan kompresi GZIP sesuai spesifikasi.
- Pembuat `BitstringStatusListCredential` siap pakai, termasuk dukungan status multi-bit (`statusSize`).
- Evaluator status (`evaluateStatus`) untuk membaca nilai status dari status list terkompresi.
- Helper `applyStatusUpdates` untuk batch update dan `syncEncodedList` untuk menyelaraskan kembali credential.
- Ditulis dengan TypeScript, diekspor sebagai modul ESM dan CJS melalui `tsup`.

## Instalasi

```bash
npm install
```

## Skrip yang tersedia

- `npm run dev` – menjalankan aplikasi Next.js (API + UI) dalam mode pengembangan
- `npm run build` – build produksi Next.js
- `npm run start` – menjalankan hasil build Next.js
- `npm run lint` – menjalankan `next lint`
- `npm run typecheck` – validasi tipe dengan TypeScript (`tsc --noEmit`)
- `npm run lib:build` – membangun paket library (`dist/`) untuk publikasi NPM
- `npm test` – menjalankan unit test (Vitest)

## Contoh Penggunaan

```ts
import {
  createStatusListCredential,
  syncEncodedList,
  applyStatusUpdates,
  evaluateStatus,
} from 'vc-bitstring-status-list';

// 1. Buat status list credential baru
const { credential, list } = createStatusListCredential({
  issuer: 'did:example:issuer',
  statusPurpose: 'revocation',
  id: 'https://example.com/credentials/status/3',
  listId: 'https://example.com/credentials/status/3#list',
});

// 2. Tandai beberapa credential sebagai tidak valid
applyStatusUpdates(list, [
  { index: 42, value: 1 },
  { index: 1337, value: 1 },
]);

// 3. Perbarui encodedList di credential
syncEncodedList(credential, list);

// 4. Evaluasi status sebuah credential
const result = evaluateStatus({
  encodedList: credential.credentialSubject.encodedList,
  statusListIndex: '42',
  statusPurpose: 'revocation',
});

console.log(result.valid); // false
```

## Alur Kerja yang Disarankan

1. **Issuer membuat daftar status baru** dengan `createStatusListCredential`, tentukan `statusPurpose`, panjang daftar, dan (jika perlu) status multi-bit.
2. **Issuer memperbarui status** ketika ada perubahan (mis. revocation) menggunakan `setEntry` langsung atau `applyStatusUpdates` untuk batch update.
3. **Issuer mem-publish credential** (mis. lewat HTTP endpoint) sehingga `encodedList` terbaru dapat diunduh oleh verifier. Gunakan `syncEncodedList` sebelum publikasi.
4. **Verifier mengunduh dan mengevaluasi** status menggunakan `evaluateStatus`, memeriksa nilai `status` dan `valid` untuk menentukan apakah credential masih sah.

> Tidak wajib membuat UI, tetapi Anda bisa menambahkan dashboard kecil (mis. React/Next.js atau CLI interaktif) yang memanggil API di atas untuk menampilkan isi daftar, menangkap perubahan, atau memvisualisasikan statistik revocation/suspension.

### Demo Next.js Terintegrasi

Aplikasi Next.js bawaan menggabungkan backend API (route handler) dan UI simulasi.

1. Jalankan mode pengembangan:

   ```bash
   npm run dev
   ```

2. Buka `http://localhost:4000` untuk mengakses dashboard end-to-end:

   - Langkah penerbitan credential → holder check → verifikasi → pencabutan disajikan dengan JSON setiap tahap.
   - Form konfigurasi `statusPurpose` serta kamus `statusMessages` (untuk mode `message`).
   - Eksperimen manual untuk memperbarui bitstring atau mengecek indeks tertentu.
   - Panel log proses real-time yang mendokumentasikan setiap aksi backend.

Jika backend/API dipisah dari Next.js (misal memakai deployment terpisah), set variabel lingkungan `NEXT_PUBLIC_API_BASE` saat build/serve agar UI memanggil endpoint yang benar.

## Struktur Proyek

- `app/` – aplikasi Next.js (UI dan route handler API)
- `lib/` – logika simulator untuk API Next.js
- `src/` – paket library TypeScript yang dapat dipublikasikan
- `tests/` – unit test Vitest untuk library
- `dist/` – artefak build library (setelah `npm run lib:build`)

## Lisensi

MIT
