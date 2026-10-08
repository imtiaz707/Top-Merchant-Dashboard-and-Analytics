'use client';
import { useState } from 'react';

const BEE = '#FFCC00', CHAR = '#15171C', LINE = '#E8EAEE', INK = '#181B21', INK3 = '#959CA8', BAD = '#D93B36';
const TEAMS = ['Operations', 'KAM', 'Business', 'Leads'];

export default function LoginForm({ demo }) {
  const [username, setU] = useState('');
  const [password, setP] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function signIn(u, p) {
    setErr('');
    if (!u || !p) { setErr('Please enter both ID and password.'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin', body: JSON.stringify({ username: u, password: p }),
      });
      if (res.ok) { window.location.href = '/dashboard'; return; }
      const data = await res.json().catch(() => ({}));
      setErr(data.error || 'Invalid ID or Password.'); // no reload
    } catch { setErr('Could not reach the server. Please try again.'); }
    finally { setLoading(false); }
  }
  const submit = () => signIn(username, password);
  const onKey = (e) => { if (e.key === 'Enter') submit(); };

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24,
      fontFamily: 'Inter,-apple-system,"Segoe UI",Roboto,sans-serif', color: INK,
      background: `radial-gradient(1100px 520px at 15% -10%,rgba(255,204,0,.16),transparent 60%),radial-gradient(900px 480px at 110% 120%,rgba(255,204,0,.10),transparent 55%),#0F1013` }}>
      <div style={{ width: '100%', maxWidth: 392, background: '#fff', border: `1px solid ${LINE}`, borderRadius: 18, boxShadow: '0 24px 60px rgba(0,0,0,.35)', padding: '30px 28px 26px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: BEE, color: '#1A1606', display: 'grid', placeItems: 'center', fontFamily: '"Space Grotesk",sans-serif', fontWeight: 700, fontSize: 20, boxShadow: '0 6px 16px rgba(255,204,0,.4)' }}>MA</div>
          <div style={{ fontFamily: '"Space Grotesk",sans-serif', fontWeight: 600, fontSize: 19, color: CHAR }}>Merchant Analytics<span style={{ display: 'block', fontFamily: 'inherit', fontWeight: 400, fontSize: 11.5, color: INK3 }}>Logistics performance dashboard</span></div>
        </div>

        {demo ? (
          <>
            <h1 style={h1}>Explore the live demo</h1>
            <div style={sub}>Pick a team to sign in. All merchants and figures are generated sample data.</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {TEAMS.map((t) => (
                <button key={t} onClick={() => signIn(t.toLowerCase(), 'demo')} disabled={loading}
                  style={{ ...(t === 'Leads' ? btn : btnAlt), marginTop: 0, opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}>
                  {t}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 11.5, color: INK3, marginTop: 12, lineHeight: 1.6 }}>
              Role-based access: only <b style={{ color: '#5C636F' }}>Leads</b> can export CSV from the Aging page — try another team to see the gate.
            </div>
          </>
        ) : (
          <>
            <h1 style={h1}>Sign in to your workspace</h1>
            <div style={sub}>Use your team credentials to continue.</div>
            <label style={lbl}>Username / Email</label>
            <input value={username} onChange={(e) => setU(e.target.value)} onKeyDown={onKey} autoFocus placeholder="e.g. leads" style={inp} />
            <label style={lbl}>Password</label>
            <input type="password" value={password} onChange={(e) => setP(e.target.value)} onKeyDown={onKey} placeholder="••••••••" style={inp} />
            <button onClick={submit} disabled={loading} style={{ ...btn, opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </>
        )}

        {err && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#FBE8E7', color: BAD, border: '1px solid #F1C8C6', borderRadius: 10, padding: '9px 12px', fontSize: 12.5, fontWeight: 500, marginTop: 16 }}>
            <span>⚠</span><span>{err}</span>
          </div>
        )}
        {!demo && (
          <div style={{ marginTop: 20, paddingTop: 14, borderTop: `1px solid ${LINE}`, fontSize: 11, color: INK3, lineHeight: 1.7 }}>
            <b style={{ color: '#5C636F' }}>Teams:</b> Operations · KAM · Business · Leads
          </div>
        )}
      </div>
    </div>
  );
}
const h1 = { fontFamily: '"Space Grotesk",sans-serif', fontSize: 17, fontWeight: 600, margin: '20px 0 3px' };
const sub = { fontSize: 12.5, color: '#959CA8', marginBottom: 18 };
const lbl = { display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.5px', color: '#959CA8', fontWeight: 600, margin: '14px 0 6px' };
const inp = { width: '100%', border: '1px solid #E8EAEE', borderRadius: 11, padding: '12px 13px', font: 'inherit', fontSize: 14, color: '#181B21', background: '#fff', boxSizing: 'border-box' };
const btn = { width: '100%', marginTop: 20, border: '1px solid #ECBD00', background: '#FFCC00', color: '#1A1606', fontFamily: '"Space Grotesk",sans-serif', fontWeight: 600, fontSize: 15, padding: 13, borderRadius: 11 };
const btnAlt = { ...btn, background: '#fff', border: '1px solid #E8EAEE', color: '#181B21' };
