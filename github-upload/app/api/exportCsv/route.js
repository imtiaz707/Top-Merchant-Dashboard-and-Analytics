import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken, COOKIE } from '@/lib/auth';
import { getCsvExportData } from '@/lib/sheets';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await verifyToken(cookies().get(COOKIE)?.value);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // Feature-gate: Export CSV is exclusive to the Leads team.
  if (session.team !== 'Leads') {
    return NextResponse.json({ error: 'Unauthorized Access — Export CSV is restricted to the Leads team.' }, { status: 403 });
  }
  try {
    const { fileName, values } = await getCsvExportData();
    const esc = (v) => { v = v == null ? '' : String(v); return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    const csv = '\uFEFF' + values.map((row) => row.map(esc).join(',')).join('\r\n');
    return new NextResponse(csv, { status: 200, headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    }});
  } catch (err) {
    return NextResponse.json({ error: 'CSV export failed. ' + (err?.message || '') }, { status: 500 });
  }
}
