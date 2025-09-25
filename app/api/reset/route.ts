import { handleJson } from '@/lib/api';
import { resetStatusList } from '@/lib/simulator';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  return handleJson(() => resetStatusList(body));
}
