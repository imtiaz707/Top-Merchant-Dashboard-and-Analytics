import { NextResponse } from 'next/server';
import { verifyToken, COOKIE } from '@/lib/auth';

// Public paths that never require a session.
const PUBLIC = ['/login', '/api/auth/login', '/api/auth/logout', '/api/revalidate'];

export async function middleware(req) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p + '/'))) return NextResponse.next();

  const session = await verifyToken(req.cookies.get(COOKIE)?.value);
  if (session) {
    if (pathname === '/') return NextResponse.redirect(new URL('/dashboard', req.url));
    return NextResponse.next();
  }
  // Unauthenticated
  if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const url = new URL('/login', req.url);
  return NextResponse.redirect(url);
}

// Guard everything except Next internals and static/vendor assets.
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|vendor/).*)'],
};
