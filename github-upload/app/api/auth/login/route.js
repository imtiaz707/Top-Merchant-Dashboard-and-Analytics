import { NextResponse } from 'next/server';
import { validate, createToken, COOKIE, cookieOptions } from '@/lib/auth';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  let body = {};
  try { body = await req.json(); } catch {}
  const team = validate(body.username, body.password);
  if (!team) return NextResponse.json({ ok: false, error: 'Invalid ID or Password.' }, { status: 401 });
  let token;
  try { token = await createToken(team); }
  catch { return NextResponse.json({ ok: false, error: 'Server is not configured for sign-in.' }, { status: 500 }); }
  const res = NextResponse.json({ ok: true, team });
  res.cookies.set(COOKIE, token, cookieOptions);
  return res;
}
