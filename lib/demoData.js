/**
 * lib/demoData.js — synthetic dataset for demo mode.
 * Produces the same nine header-keyed tabs the Sheets engine returns, so the
 * dashboard cannot tell the difference. Everything here is invented: merchant
 * names, volumes and money are generated, not sampled from any real system.
 *
 * - Deterministic: every value is a hash of (merchant, calendar day, field),
 *   so a given day never changes between requests or deploys.
 * - Rolling: the window always ends today, so the demo never looks stale.
 * - Story-driven: a few merchants are given deliberate problems so each alert
 *   rule has something to flag.
 */
const DAYS = 75;            // history window
const PICKUP_DAYS = 14;     // pickup automation rows are only kept for recent days
const TZ_OFFSET_HOURS = 6;  // business day rolls over at UTC+6
const BUCKETS = ['1', '2', '3', '4', '5', '6', '7', '7+'];

const NAMES = [
  'Aurora Fashion House', 'Nimbus Electronics', 'Harvest Basket Grocers', 'Lumen Home Decor',
  'Tidewater Books', 'Saffron Kitchenware', 'Pixel Gadget Store', 'Meadow Organics',
  'Cobalt Sports Gear', 'Juniper Beauty', 'Atlas Footwear', 'Marigold Kids',
  'Quartz Watches', 'Driftwood Furniture', 'Ember Spice Co', 'Willow Stationery',
  'Onyx Mobile Accessories', 'Clover Pet Supplies', 'Zephyr Apparel', 'Basil Health Mart',
];

// Deliberate problem cases, by merchant index (see the Alerts page).
const STORY = {
  dropToday:  [11],     // processed volume collapses on the latest day
  revDecline: [8, 15],  // revenue falls week over week
  leak:       [13, 17], // large share of billing not invoiced
  slaBad:     [3, 16],  // SLA breach above threshold
  lowFirstSR: [18],     // poor first-attempt success
  highReturn: [5],      // elevated return ratio
  highZT:     [7],      // heavy zone transfer
  inactive:   [19],     // stopped sending parcels
};
const has = (flag, i) => STORY[flag].includes(i);

const CLUSTERS = [
  ['ISD', 'Metro North'], ['ISD', 'Metro South'], ['ISD', 'Metro East'],
  ['OSD', 'Port City'], ['OSD', 'Northern Hills'], ['OSD', 'River Delta'], ['OSD', 'Western Plains'],
];
const AGE_ISD = [0.42, 0.30, 0.13, 0.07, 0.04, 0.02, 0.01, 0.01];
const AGE_OSD = [0.20, 0.28, 0.22, 0.13, 0.08, 0.05, 0.02, 0.02];

// Share of a day's parcels that have reached a terminal state, by age in days.
// It plateaus below 1: a small tail of parcels stays open (disputes, re-attempts).
const MATURITY = [0.38, 0.72, 0.86, 0.92, 0.95, 0.965, 0.97];
// Share of returns already handed back to the merchant, by age in days.
const RETURNED = [0, 0.10, 0.30, 0.50, 0.70, 0.85, 0.95];

/* ── deterministic randomness ── */
function rnd(...parts) {
  const s = parts.join('|');
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 15; h = Math.imul(h, 2246822507); h ^= h >>> 13; h = Math.imul(h, 3266489909); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const between = (lo, hi, ...key) => lo + (hi - lo) * rnd(...key);
const r2 = (n) => Math.round(n * 100) / 100;
const r4 = (n) => Math.round(n * 10000) / 10000;

/* ── date helpers (all on UTC day numbers) ── */
const iso = (day) => new Date(day * 86400000).toISOString().slice(0, 10);
const dow = (day) => new Date(day * 86400000).getUTCDay(); // 0 = Sunday
function isoWeek(day) {
  const d = new Date(day * 86400000);
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7)); // Thursday of this ISO week
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}
function todayDay() { return Math.floor((Date.now() + TZ_OFFSET_HOURS * 3600000) / 86400000); }

/* ── merchant profiles (stable per merchant) ── */
function profiles() {
  return NAMES.map((name, i) => {
    const id = 1001 + i;
    return {
      i, id, name,
      base: Math.round(2600 * Math.pow(0.86, i) + 120),             // long-tail volume
      retRate: has('highReturn', i) ? 0.19 : between(0.05, 0.11, id, 'ret'),
      dsr: between(0.76, 0.9, id, 'dsr'),
      breach: has('slaBad', i) ? between(0.19, 0.25, id, 'br') : between(0.04, 0.10, id, 'br'),
      firstSR: has('lowFirstSR', i) ? 0.34 : between(0.62, 0.84, id, 'fsr'),
      zt: has('highZT', i) ? 0.095 : between(0.015, 0.05, id, 'zt'),
      leak: has('leak', i) ? between(0.28, 0.38, id, 'leak') : between(0.03, 0.10, id, 'leak'),
      aging: (has('slaBad', i) ? 3.4 : between(1.7, 2.9, id, 'age')),
      aov: between(900, 2600, id, 'aov'),                           // average order value
      fee: between(70, 120, id, 'fee'),                             // delivery fee per parcel
      disc: between(0.03, 0.12, id, 'disc'),
      isdShare: between(0.35, 0.75, id, 'isd'),
    };
  });
}

// Split `total` into integer parts by weight; the remainder lands on the last part.
function split(total, weights) {
  const sum = weights.reduce((a, w) => a + w, 0);
  const out = weights.map((w) => Math.floor((total * w) / sum));
  out[out.length - 1] += total - out.reduce((a, x) => a + x, 0);
  return out;
}

function build(maxDay) {
  const merchants = profiles();
  const firstDay = maxDay - DAYS + 1;
  // Monday of the latest complete ISO week — where the "revenue declining" story starts.
  const declineFrom = maxDay - dow(maxDay) - 6;

  const daily = [], cohort = [], financial = [], pickup = [];

  for (const m of merchants) {
    for (let day = firstDay; day <= maxDay; day++) {
      const age = maxDay - day;
      if (has('inactive', m.i) && age <= 4) continue; // went quiet five days ago

      let vol = m.base * (1 + 0.002 * (day - firstDay)) * between(0.93, 1.07, m.id, day, 'vol');
      if (dow(day) === 5) vol *= 0.85; // Friday dip
      if (dow(day) === 6) vol *= 0.95;
      if (has('dropToday', m.i) && age === 0) vol *= 0.45;
      if (has('revDecline', m.i) && day >= declineFrom) vol *= 0.62;

      const requested = Math.max(1, Math.round(vol));
      const processed = Math.round(requested * between(0.94, 0.99, m.id, day, 'proc'));
      const p = MATURITY[Math.min(age, MATURITY.length - 1)];
      const terminal = Math.round(processed * p);
      const ret = Math.round(terminal * m.retRate * between(0.85, 1.15, m.id, day, 'ret'));
      const lostDamage = Math.round(terminal * 0.004);
      const delivered = terminal - ret - lostDamage;
      const pending = Math.round((processed - terminal) * 0.12);
      const inProcess = processed - terminal - pending;
      const attempts = delivered + ret + Math.round(delivered * (1 / m.dsr - 1));
      const firstMade = Math.round(processed * Math.min(1, p + 0.05));
      const firstSR = r4(Math.min(0.98, m.firstSR * between(0.94, 1.06, m.id, day, 'fsr')));
      const breachRatio = r4(m.breach * between(0.85, 1.15, m.id, day, 'br'));

      const ipBreached = Math.min(inProcess, Math.round(inProcess * breachRatio * 1.2));
      const slaBreached = Math.round(terminal * breachRatio) + ipBreached;
      const withinSla = terminal + inProcess - slaBreached;
      const [atFmh, atCw, atSub, otwLmh, atLmh] = split(inProcess, [0.14, 0.20, 0.16, 0.20, 0.30]);

      const returnedToMerchant = Math.round(ret * RETURNED[Math.min(age, RETURNED.length - 1)]);
      const revOpen = ret - returnedToMerchant;
      const revInventory = Math.round(revOpen * 0.25);
      const revInProcess = revOpen - revInventory;
      const [rvFmh, rvCw, rvSub, rvLmh, rvOtw] = split(revInProcess, [0.30, 0.25, 0.15, 0.18, 0.12]);

      const date = iso(day), week = isoWeek(day), month = date.slice(0, 7);
      const key = { 'Date': date, 'Week': week, 'Month': month, 'Business ID': m.id, 'Business Name': m.name };

      daily.push({ ...key,
        'Requested': requested, 'Processed': processed, 'Delivered': delivered, 'Return': ret,
        'In Process': inProcess, 'Pending': pending, 'Lost & Damage': lostDamage,
        'Total Attempts': attempts, '1st Attempt Made': firstMade, '1st Attempt SR': firstSR,
        'Return Ratio': r4(m.retRate * between(0.9, 1.1, m.id, day, 'rr')),
        'SLA Breached': slaBreached, 'Within SLA': withinSla,
        'Within SLA: In Process Parcels': inProcess - ipBreached, 'SLA Breached: In Process Parcels': ipBreached,
        'Zone Transfer Parcel Count': Math.round(processed * m.zt),
        'Zone Transfer Ratio': r4(m.zt * between(0.9, 1.1, m.id, day, 'zt')),
        'At FMH': atFmh, 'At Central Warehouse': atCw, 'At Sub Sort': atSub, 'On the Way to LMH': otwLmh, 'At LMH': atLmh,
        'Reverse Created': ret, 'Reverse In Process': revInProcess, 'Returned to Merchant': returnedToMerchant,
        'Reverse at Inventory': revInventory, 'Reverse at FMH': rvFmh, 'Reverse at Central Warehouse': rvCw,
        'Reverse at Sub Sort': rvSub, 'Reverse at LMH': rvLmh, 'Reverse On the Way to LMH': rvOtw,
      });

      const collected = Math.round(delivered * m.aov * between(0.95, 1.05, m.id, day, 'aov'));
      const deliveryFee = Math.round(processed * m.fee);
      const codFee = Math.round(collected * 0.01);
      const discount = Math.round(deliveryFee * m.disc);
      const revenue = deliveryFee + codFee - discount;
      const realized = Math.round(revenue * (processed ? terminal / processed : 0));
      const overallAging = r2(m.aging * between(0.9, 1.1, m.id, day, 'age'));

      cohort.push({ ...key,
        'Processed': processed, 'Delivered': delivered, 'Return': ret, 'Total Attempts': attempts,
        '1st Attempt': firstMade, '1st Attempt SR': firstSR, 'SLA Breach Ratio': breachRatio,
        'Overall Aging': overallAging, '1st Attempt Aging': r2(overallAging * 0.55),
        'Collected Amount': collected, 'Delivery Fee': deliveryFee, 'COD Fee': codFee, 'Discount': discount,
        'Revenue': revenue, 'Realized Revenue': realized, 'Unrealized Revenue': revenue - realized,
      });

      financial.push({ ...key,
        'Payable': Math.max(0, collected - revenue), 'Billing Amount': revenue,
        'Not Invoiced Amount': Math.round(revenue * m.leak * between(0.9, 1.1, m.id, day, 'leak')),
      });

      if (age < PICKUP_DAYS) {
        const req = rnd(m.id, day, 'pk-req') < 0.86;
        const assigned = req && rnd(m.id, day, 'pk-asg') < 0.9;
        const picked = assigned && rnd(m.id, day, 'pk-pick') < 0.92;
        const mins = Math.floor(between(9 * 60, 18 * 60, m.id, day, 'pk-time'));
        pickup.push({ ...key,
          'Pickup Requested': req ? 1 : 0, 'Ops Run Assigned': assigned ? 1 : 0,
          'Pickup Agent Picked': picked ? 'Agent ' + String(1 + Math.floor(rnd(m.id, day, 'pk-agent') * 24)).padStart(2, '0') : '',
          'Pickup Request Time': req ? `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}` : '',
        });
      }
    }
  }

  // Aging snapshots: open/closed parcels by days-in-state, per merchant and delivery cluster.
  const aging = (tab, scale) => {
    const rows = [];
    for (const m of merchants) {
      if (has('inactive', m.i) && tab.endsWith('Proc')) continue;
      const total = m.base * scale(m);
      for (const [region, cluster] of CLUSTERS) {
        const peers = CLUSTERS.filter((c) => c[0] === region).length;
        const share = (region === 'ISD' ? m.isdShare : 1 - m.isdShare) / peers;
        const weights = (region === 'ISD' ? AGE_ISD : AGE_OSD).map((w, b) => (has('slaBad', m.i) && b >= 3 ? w * 2.4 : w));
        const wsum = weights.reduce((a, w) => a + w, 0);
        const counts = weights.map((w, b) => Math.round((total * share * between(0.8, 1.2, m.id, tab, cluster) * w) / wsum * between(0.85, 1.15, m.id, tab, cluster, b)));
        const sum = counts.reduce((a, x) => a + x, 0);
        if (!sum) continue;
        const row = { 'Business ID': m.id, 'Business Name': m.name, 'Delivery Region': region, 'Delivery Cluster': cluster };
        BUCKETS.forEach((b, k) => { row[b] = counts[k]; });
        row['Total'] = sum;
        rows.push(row);
      }
    }
    return rows;
  };

  const tabs = {
    daily, cohort, financial, pickup,
    fwdTerm: aging('fwdTerm', () => 6.5),
    fwdProc: aging('fwdProc', () => 1.3),
    revTerm: aging('revTerm', (m) => m.retRate * 6),
    revProc: aging('revProc', (m) => m.retRate * 3),
  };
  return { generatedAt: new Date().toISOString(), demo: true, tabs };
}

let _memo = { day: null, payload: null };

export function getDemoDashboardData() {
  const day = todayDay();
  if (_memo.day !== day) _memo = { day, payload: build(day) };
  return { ..._memo.payload, generatedAt: new Date().toISOString() };
}

// Flat aging export, mirroring what the "CSV Export" sheet tab provides in live mode.
export function getDemoCsvExport() {
  const { tabs } = getDemoDashboardData();
  const head = ['Business ID', 'Business Name', 'Direction', 'Stage', 'Delivery Region', 'Delivery Cluster', ...BUCKETS, 'Total'];
  const values = [head];
  const add = (key, direction, stage) => tabs[key].forEach((r) => values.push([
    r['Business ID'], r['Business Name'], direction, stage, r['Delivery Region'], r['Delivery Cluster'],
    ...BUCKETS.map((b) => r[b]), r['Total'],
  ]));
  add('fwdProc', 'Forward', 'In Process'); add('fwdTerm', 'Forward', 'Terminal');
  add('revProc', 'Reverse', 'In Process'); add('revTerm', 'Reverse', 'Terminal');
  return { fileName: 'aging_export_demo.csv', values };
}
