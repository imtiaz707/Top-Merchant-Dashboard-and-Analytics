/**
 * lib/config.js — runtime mode switch (edge-safe, no Node imports).
 * Demo mode serves generated sample data and needs no Google credentials.
 * It is on when DEMO_MODE=true, or when no SHEET_ID is configured (so a fresh
 * clone runs out of the box). Set DEMO_MODE=false to force live mode.
 */
export function isDemo() {
  if (process.env.DEMO_MODE === 'true') return true;
  if (process.env.DEMO_MODE === 'false') return false;
  return !process.env.SHEET_ID;
}

export const DEMO_PASSWORD = 'demo';
