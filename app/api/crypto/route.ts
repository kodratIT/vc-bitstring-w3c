import { handleJson } from '@/lib/api';
import { getCryptoDetails } from '@/lib/crypto';

export const runtime = 'nodejs';

export async function GET() {
  return handleJson(() => getCryptoDetails());
}