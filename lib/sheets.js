/**
 * lib/sheets.js — Bulletproof Google Sheets v4 fetching engine.
 * - google-auth-library / googleapis service account (read-only)
 * - single batchGet, header-keyed rows (no positional/column drift)
 * - strict, crash-proof coercion: bad/empty cells become '' (never throw)
 * - ISR: results cached via unstable_cache, revalidate every 21600s (6h),
 *   tagged 'sheets' so a webhook can purge on the 4x/day ETL run.
 */
import { google } from 'googleapis';
import { unstable_cache, revalidateTag } from 'next/cache';
import { isDemo } from '@/lib/config';
import { getDemoDashboardData, getDemoCsvExport } from '@/lib/demoData';

export const SHEET_ID = process.env.SHEET_ID || '';
export const REVALIDATE_SECONDS = 21600; // 6 hours (sheet refreshes 4x/day)
export const SHEETS_TAG = 'sheets';

export const TABS = {
  daily:    'Daily Merchant Summary',
  fwdTerm:  'Forward Aging Analysis - Terminal',
  fwdProc:  'Forward Aging Analysis - In Process',
  revTerm:  'Reverse Aging Analysis - Terminal',
  revProc:  'Reverse Aging Analysis - In Process',
  cohort:   'Sorted Cohort Summary',
  financial:'Financial Detail',
  pickup:   'Pickup Automation',
  csvExport:'CSV Export',
};

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];

let _client = null;
function sheetsClient() {
  if (_client) return _client;
  let auth;
  if (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
    // Vercel-friendly: credentials straight from env (escape newlines as \n).
    auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: String(process.env.GOOGLE_PRIVATE_KEY).replace(/\\n/g, '\n'),
      },
      scopes: SCOPES,
    });
  } else {
    // On-prem: GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json (ADC).
    auth = new google.auth.GoogleAuth({ scopes: SCOPES });
  }
  _client = google.sheets({ version: 'v4', auth });
  return _client;
}

function tabRange(name) { return `'${String(name).replace(/'/g, "''")}'`; }

// Strict, non-throwing normalization: undefined/null -> '', trim strings.
function safeCell(v) {
  if (v === undefined || v === null) return '';
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'boolean') return v;
  return String(v).trim();
}

function rowsToObjects(values) {
  if (!Array.isArray(values) || values.length < 2) return [];
  const headers = values[0].map((h) => String(h == null ? '' : h).trim());
  const out = [];
  for (let i = 1; i < values.length; i++) {
    const row = Array.isArray(values[i]) ? values[i] : [];
    if (row.every((c) => c === '' || c == null)) continue;
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      if (!headers[j]) continue;
      obj[headers[j]] = safeCell(row[j]);
    }
    out.push(obj);
  }
  return out;
}

async function fetchAllTabs() {
  const sheets = sheetsClient();
  // The CSV Export tab is Leads-only and served by its own route — never ship it in the shared payload.
  const keys = Object.keys(TABS).filter((k) => k !== 'csvExport');
  const resp = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: SHEET_ID,
    ranges: keys.map((k) => tabRange(TABS[k])),
    valueRenderOption: 'UNFORMATTED_VALUE',      // real numbers, no thousands separators
    dateTimeRenderOption: 'FORMATTED_STRING',    // dates as displayed yyyy-MM-dd text
  });
  const valueRanges = (resp.data && resp.data.valueRanges) || [];
  const tabs = {};
  keys.forEach((k, i) => { tabs[k] = rowsToObjects((valueRanges[i] || {}).values || []); });
  return { generatedAt: new Date().toISOString(), tabs };
}

// ISR wrapper. First call in a 6h window hits the API; the rest are cached.
const getSheetData = unstable_cache(fetchAllTabs, ['cb-sheets-dashboard'], {
  revalidate: REVALIDATE_SECONDS,
  tags: [SHEETS_TAG],
});

// Demo mode never touches Google or the data cache.
export async function getDashboardData() {
  return isDemo() ? getDemoDashboardData() : getSheetData();
}

// Manual purge (used by the refresh button and the ETL webhook).
export async function purgeSheetsCache() { if (!isDemo()) revalidateTag(SHEETS_TAG); }

// CSV Export tab as display values (formatted), not cached (small, on-demand).
export async function getCsvExportData() {
  if (isDemo()) return getDemoCsvExport();
  const sheets = sheetsClient();
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: tabRange(TABS.csvExport),
    valueRenderOption: 'FORMATTED_VALUE',
    dateTimeRenderOption: 'FORMATTED_STRING',
  });
  return { fileName: 'aging_export.csv', values: (resp.data && resp.data.values) || [] };
}
