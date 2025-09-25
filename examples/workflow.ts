import {
  applyStatusUpdates,
  createStatusListCredential,
  evaluateStatus,
  syncEncodedList,
  BitstringStatusList,
} from '../src/index';

function section(title: string): void {
  console.log(`\n=== ${title} ===`);
}

function logCredentialSummary(credentialId: string | undefined, list: BitstringStatusList): void {
  console.log('Credential ID:', credentialId ?? '(tidak diset)');
  console.log('Total entri yang tersedia:', list.entryCount);
  console.log('Status size (bit per entri):', list.statusSize);
}

section('1. Membuat status list credential baru');
const { credential, list } = createStatusListCredential({
  issuer: 'did:example:issuer',
  statusPurpose: 'revocation',
  id: 'https://example.com/credentials/status/3',
  listId: 'https://example.com/credentials/status/3#list',
});
logCredentialSummary(credential.id, list);

section('2. Menandai credential tertentu sebagai tidak valid');
applyStatusUpdates(list, [
  { index: 42, value: 1 },
  { index: 1_337, value: 1 },
]);
console.log('Index 42 dan 1337 diset ke status 1 (revoked).');

section('3. Menyelaraskan encodedList di credential');
syncEncodedList(credential, list);
console.log('encodedList panjang:', credential.credentialSubject.encodedList.length, 'karakter');

section('4. Verifier mengevaluasi status');
const checkIndices = [10, 42, 1_337];
for (const index of checkIndices) {
  const evaluation = evaluateStatus({
    encodedList: credential.credentialSubject.encodedList,
    statusListIndex: index,
    statusPurpose: credential.credentialSubject.statusPurpose,
  });
  console.log(
    `Index ${index}: status=${evaluation.status}, valid=${evaluation.valid ? 'ya' : 'tidak'}`
  );
}

section('Selesai');
console.log('Demo ini menunjukkan alur issuer dan verifier tanpa antarmuka UI.');
console.log('Anda dapat mengadaptasi skrip ini ke dashboard web/CLI sesuai kebutuhan.');
