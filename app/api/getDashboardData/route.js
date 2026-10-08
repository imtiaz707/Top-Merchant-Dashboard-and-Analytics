import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken, COOKIE } from '@/lib/auth';
import { getDashboardData, purgeSheetsCache } from '@/lib/sheets';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req) {
  const session = await verifyToken(cookies().get(COOKIE)?.value);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const refresh = req.nextUrl.searchParams.get('refresh');
    if (refresh === '1' || refresh === 'true') await purgeSheetsCache(); // manual purge
    const payload = await getDashboardData();
    return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to load dashboard data. ' + (err?.message || '') }, { status: 500 });
  }
}
