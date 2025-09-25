import { NextResponse } from 'next/server';

import { StatusListError } from '@/src/errors';

export async function handleJson<T>(handler: () => Promise<T> | T): Promise<NextResponse> {
  try {
    const result = await handler();
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof StatusListError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: 400 });
    }
    console.error('Unhandled server error:', error);
    return NextResponse.json({ message: 'Terjadi kesalahan pada server.' }, { status: 500 });
  }
}
