import { handleJson } from '@/lib/api';
import { simulateRevocation } from '@/lib/simulator';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  return handleJson(() => simulateRevocation(body));
}
