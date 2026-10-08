import { cookies } from 'next/headers';
import { verifyToken, COOKIE } from '@/lib/auth';
import { isDemo } from '@/lib/config';
import template from '@/templates/dashboard.html';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CDN_ECHARTS = '<script src="https://cdnjs.cloudflare.com/ajax/libs/echarts/5.5.0/echarts.min.js"></script>';
const CDN_FONTS = '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">';

export async function GET() {
  const session = await verifyToken(cookies().get(COOKIE)?.value);
  if (!session) return new Response(null, { status: 302, headers: { Location: '/login' } });

  const local = (process.env.ASSET_MODE || 'cdn') === 'local';
  const echartsSrc = local ? '<script src="/vendor/echarts.min.js"></script>' : CDN_ECHARTS;
  const fontsLink = local ? '<!-- on-prem: system font fallback (no CDN) -->' : CDN_FONTS;
  const role = String(session.team || '').replace(/[^A-Za-z]/g, ''); // safe for inline JS string

  const demo = isDemo();
  const html = template
    .split('%%CB_ROLE%%').join(role)
    .replace('%%STATIC_SCRIPT%%', '')
    .replace('%%DATA_SOURCE%%', demo ? 'Sample data' : 'Google Sheets')
    .replace('%%DEMO_PILL%%', demo ? '<span class="demopill" title="All merchants and figures are generated sample data">Demo data</span>' : '')
    .replace('%%ECHARTS_SRC%%', echartsSrc)
    .replace('%%FONTS_LINK%%', fontsLink);

  return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}
