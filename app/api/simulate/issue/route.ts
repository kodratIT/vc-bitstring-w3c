import { handleJson } from '@/lib/api';
import { simulateIssuance } from '@/lib/simulator';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  return handleJson(() => simulateIssuance(body));
}
