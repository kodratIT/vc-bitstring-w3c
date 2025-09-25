import { handleJson } from '@/lib/api';
import { simulateVerifierCheck } from '@/lib/simulator';

export const runtime = 'nodejs';

export async function POST() {
  return handleJson(() => simulateVerifierCheck());
}
