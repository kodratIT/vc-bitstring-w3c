import { handleJson } from '@/lib/api';
import { simulateHolderCheck } from '@/lib/simulator';

export const runtime = 'nodejs';

export async function POST() {
  return handleJson(async () => await simulateHolderCheck());
}
