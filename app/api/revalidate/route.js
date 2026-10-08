import { NextResponse } from 'next/server';
import { purgeSheetsCache } from '@/lib/sheets';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Call this from the 4x/day ETL (or manually) to purge the 6h ISR cache:
//   POST /api/revalidate   header: x-revalidate-secret: <REVALIDATE_SECRET>
// The secret is header-only so it never lands in URLs or access logs.
export async function POST(req) {
  const secret = process.env.REVALIDATE_SECRET;
  const provided = req.headers.get('x-revalidate-secret');
  if (!secret || provided !== secret) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  await purgeSheetsCache();
  return NextResponse.json({ ok: true, purged: 'sheets', at: new Date().toISOString() });
}
