import { NextResponse } from 'next/server';

import { getSummary } from '@/lib/simulator';

export const runtime = 'nodejs';

export async function GET(): Promise<NextResponse> {
  const data = await getSummary();
  return NextResponse.json(data, {
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  });
}
