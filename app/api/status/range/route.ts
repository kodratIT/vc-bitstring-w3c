import { NextRequest } from 'next/server';
import { handleJson } from '@/lib/api';
import { getStatusesRange } from '@/lib/simulator';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const startParam = url.searchParams.get('start') ?? '0';
  const countParam = url.searchParams.get('count') ?? '256';

  const start = Number.parseInt(startParam, 10);
  const count = Number.parseInt(countParam, 10);

  return handleJson(async () => await getStatusesRange(start, count));
}