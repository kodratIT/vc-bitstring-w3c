import { handleJson } from '@/lib/api';
import { checkStatus } from '@/lib/simulator';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  { params }: { params: { index: string } }
) {
  return handleJson(() => checkStatus(Number.parseInt(params.index, 10)));
}
