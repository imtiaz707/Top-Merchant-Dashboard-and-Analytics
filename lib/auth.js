/**
 * lib/auth.js — RBAC for four teams via a signed JWT cookie (jose, edge-safe).
 * Teams: Operations, KAM, Business, Leads. Usernames are the lowercased team
 * name (an email works too if you set the username env to the email).
 *
 * Live mode has no fallbacks: AUTH_SECRET and each TEAM_*_PASSWORD must be set,
 * and a team with no password configured cannot sign in. Demo mode uses a
 * public password and signing secret, which is fine because it only ever
 * serves generated sample data.
 */
import { SignJWT, jwtVerify } from 'jose';
import { isDemo, DEMO_PASSWORD } from '@/lib/config';

export const COOKIE = 'cb_session';
export const TEAMS = ['Operations', 'KAM', 'Business', 'Leads'];

function secret() {
  const s = process.env.AUTH_SECRET || (isDemo() ? 'public-demo-secret-sample-data-only' : '');
  if (!s) throw new Error('AUTH_SECRET is not set.');
  return new TextEncoder().encode(s);
}

// team -> { username, password }
export function credentials() {
  const demo = isDemo();
  const out = {};
  for (const team of TEAMS) {
    const K = team.toUpperCase();
    out[team] = {
      username: (process.env[`TEAM_${K}_USER`] || team).toLowerCase(),
      password: demo ? DEMO_PASSWORD : (process.env[`TEAM_${K}_PASSWORD`] || ''),
    };
  }
  return out;
}

// Length-independent comparison so response time doesn't leak how much matched.
function safeEqual(a, b) {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

export function validate(username, password) {
  const u = String(username || '').trim().toLowerCase();
  const p = String(password || '');
  const creds = credentials();
  let match = null;
  for (const team of TEAMS) {
    const c = creds[team];
    if (c.password && c.username === u && safeEqual(c.password, p)) match = team;
  }
  return match;
}

export async function createToken(team) {
  return await new SignJWT({ team })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(secret());
}

export async function verifyToken(token) {
  if (!token) return null;
  try { const { payload } = await jwtVerify(token, secret()); return payload; }
  catch { return null; }
}

export const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  // Set COOKIE_SECURE=false only when serving plain HTTP on a private network.
  secure: process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE !== 'false' : process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 60 * 60 * 8,
};
