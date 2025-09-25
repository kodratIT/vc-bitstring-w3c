import { NextResponse } from 'next/server';

import { getSummary } from '@/lib/simulator';

export const runtime = 'nodejs';

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(getSummary());
}
