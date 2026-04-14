// ── Constants (defaults — overridden by meta.json per company) ───────────────
let BGN_PER_EUR = 1.95583;
let EUR_TRANSITION_YEAR = 2026;
let DISPLAY_AMOUNT_UNIT = 'хил. EUR';
let DISPLAY_PER_SHARE_UNIT = 'EUR';
let NO_CONVERSION = false;

// CSV row labels
const ROW = {
  revenue:      'Приходи от продажби',
  cogs:         'Себестойност на продажбите',
  gross_profit: 'Брутна печалба',
  other_inc:    'Други приходи от дейността',
  sell_exp:     'Разходи за продажби',
  admin_exp:    'Административни разходи',
  other_exp:    'Други разходи за дейността',
  ebit:         'Печалба от оперативна дейност (EBIT)',
  fin_inc:      'Финансови приходи',
  fin_exp:      'Финансови разходи',
  assoc:        'Дял от печалбата на асоциирани дружества',
  ebt:          'Печалба преди данъци (EBT)',
  tax:          'Разход за данъци',
  net_cont:     'Нетна печалба от продължаващи дейности',
  discont:      'Печалба от преустановени дейности',
  net_profit:   'Нетна печалба',
  oci:          'Друг всеобхватен доход (OCI) — общо',
  total_ci:     'Общо всеобхватен доход',
  eps:          'Нетен доход на акция (EPS, лв.)',
  // Assets
  ppe:          'Имоти, машини и съоръжения',
  intangibles:  'Нематериални активи',
  rou:          'Активи с право на ползване',
  goodwill:     'Репутация',
  assoc_inv:    'Инвестиции в асоциирани дружества',
  deferred_tax: 'Активи по отсрочени данъци',
  nc_assets:    'Общо нетекущи активи',
  inventories:  'Материални запаси',
  recv:         'Търговски вземания',
  other_recv:   'Други вземания',
  cash:         'Пари и парични еквиваленти',
  curr_assets:  'Общо текущи активи',
  total_assets: 'ОБЩО АКТИВИ',
  // Liabilities
  lease_lt:     'Задължения по лизинг (дългосрочни)',
  nc_employee:  'Дългосрочни задължения към персонала',
  nc_liab:      'Общо нетекущи пасиви',
  bank_loans:   'Банкови заеми',
  lease_st:     'Задължения по лизинг (краткосрочни)',
  trade_pay:    'Търговски задължения',
  employee_pay: 'Задължения към персонала и осигуряването',
  other_pay:    'Други задължения',
  curr_liab:    'Общо текущи пасиви',
  total_liab:   'ОБЩО ПАСИВИ',
  // Equity
  share_cap:    'Регистриран акционерен капитал',
  retained:     'Неразпределена печалба',
  legal_res:    'Законови резерви',
  premium:      'Премиен резерв',
  fx_res:       'Валутно-курсови разлики',
  equity:       'ОБЩО СОБСТВЕН КАПИТАЛ',
  // Cash flows
  rcv_clients:  'Постъпления от клиенти',
  pay_suppliers:'Плащания към доставчици',
  taxes_net:    'Данъци възстановени/(платени), нето',
  pay_employee: 'Плащания към персонал и осигуряване',
  cf_op:        'Нетни парични потоци от оперативна дейност',
  capex:        'Капиталови разходи (CAPEX)',
  cf_inv:       'Нетни парични потоци от инвестиционна дейност',
  dividends:    'Изплатени дивиденти',
  cf_fin:       'Нетни парични потоци от финансова дейност',
  cash_start:   'Пари в началото на периода',
  cash_end:     'Пари в края на периода',
};

// ── State ────────────────────────────────────────────────────────────────────
let meta = {};         // loaded from companies/{id}/meta.json
let csvData = {};      // csvData[rowLabel][colKey] = string value
let periods = [];      // [{q, year, months, key}]
let allYears = [];     // ['2021','2022',...]
let activeYears = new Set();
let currentMode = 'ltm';
const charts = {};

// ── Company routing ───────────────────────────────────────────────────────────
/**
 * Reads ?company=<id> from the URL.
 * Falls back to the first subdirectory listed, or 'shelly' as last resort.
 * Example URLs:
 *   index.html?company=shelly
 *   index.html?company=acme
 */
function getCompanyId() {
  const params = new URLSearchParams(window.location.search);
  let company = params.get('company') || 'shelly';
  company = company.replace(/[^a-zA-Z0-9_-]/g, '');
  
  // Validate company is in AVAILABLE_COMPANIES, otherwise default to shelly
  if (!AVAILABLE_COMPANIES.some(c => c.id === company)) {
    company = 'shelly';
  }
  return company;
}

const AVAILABLE_COMPANIES = [
  { id: 'shelly', name: 'Шелли Груп АД' },
  { id: 'plejd', name: 'Plejd AB' },
];

function populateCompanySelector() {
  const current = getCompanyId();
  const sel = document.getElementById('company-selector');
  if (!sel) return;
  
  AVAILABLE_COMPANIES.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    if (c.id === current) opt.selected = true;
    sel.appendChild(opt);
  });
}

function switchCompany(companyId) {
  if (!companyId) return;
  const url = new URL(window.location.href);
  url.searchParams.set('company', companyId);
  window.location.href = url.toString();
}

/**
 * Applies loaded meta.json to the DOM:
 *  - page <title>
 *  - header logo letter, company name, subtitle
 *  - ticker badges
 *  - KPI label currency suffix
 *  - page footer text
 *  - currency constants
 */
function applyMeta(m) {
  // Page title
  document.title = `${m.name} – Финансов дашборд`;

  // Header
  document.getElementById('header-logo').textContent = m.logo_letter || m.name.charAt(0);
  document.getElementById('company-name').textContent = m.name;
  document.getElementById('company-subtitle').textContent = m.subtitle || '';

  // Ticker badges
  const tickersEl = document.getElementById('company-tickers');
  tickersEl.innerHTML = (m.tickers || []).map(t =>
    `<a class="ticker-badge" href="${t.url}" target="_blank" rel="noopener">${t.label}</a>`
  ).join('');

  // Currency constants from meta
  if (m.currency) {
    NO_CONVERSION      = m.currency.no_conversion    ?? NO_CONVERSION;
    BGN_PER_EUR        = m.currency.rate_bgn_eur      ?? m.currency.rate_sek_eur ?? BGN_PER_EUR;
    EUR_TRANSITION_YEAR = NO_CONVERSION ? null : (m.currency.eur_from_year ?? EUR_TRANSITION_YEAR);
    DISPLAY_AMOUNT_UNIT = m.currency.display_unit    ?? DISPLAY_AMOUNT_UNIT;
    DISPLAY_PER_SHARE_UNIT = m.currency.display        ?? DISPLAY_PER_SHARE_UNIT;
  }

  // KPI labels — append display currency
  const disp = DISPLAY_PER_SHARE_UNIT;
  document.getElementById('kpi-revenue-label').textContent   = `Приходи (${disp})`;
  document.getElementById('kpi-netprofit-label').textContent = `Нетна печалба (${disp})`;
  document.getElementById('kpi-eps-label').textContent       = `EPS (${disp} на акция)`;

  // Footer
  const footerEl = document.getElementById('page-footer');
  if (footerEl) footerEl.textContent = m.footer || '';
}

// ── Formatting ───────────────────────────────────────────────────────────────
function fmtNum(v, decimals = 0) {
  if (v == null || isNaN(v)) return '–';
  return v.toLocaleString('bg-BG', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
function fmtMoney(v) {
  if (v == null || isNaN(v)) return '–';
  const abs = Math.abs(v);
  if (abs >= 100000) return (v < 0 ? '-' : '') + (Math.abs(v)/1000).toLocaleString('bg-BG',{minimumFractionDigits:1,maximumFractionDigits:1}) + ' млн.';
  return v.toLocaleString('bg-BG', {minimumFractionDigits:0, maximumFractionDigits:0});
}
const fmtBGN = fmtMoney;
function fmtAmountCompact(v) {
  if (v == null || isNaN(v)) return '–';
  const abs = Math.abs(v);
  const unit = DISPLAY_AMOUNT_UNIT;  // e.g., "хил. EUR" or "хил. SEK"
  const unitShort = unit.replace('хил. ', '');  // "EUR" or "SEK"
  if (abs >= 1000) return (v < 0 ? '-' : '') + (Math.abs(v)/1000).toLocaleString('bg-BG',{minimumFractionDigits:1,maximumFractionDigits:1}) + ` млн. ${unitShort}`;
  return v.toLocaleString('bg-BG',{minimumFractionDigits:0,maximumFractionDigits:0}) + ` ${unit}`;
}
function fmtAmountTooltip(v, absolute = false) {
  const val = absolute ? Math.abs(v) : v;
  if (val == null || isNaN(val)) return '–';
  return val.toLocaleString('bg-BG',{minimumFractionDigits:0,maximumFractionDigits:0}) + ` ${DISPLAY_AMOUNT_UNIT}`;
}
function fmtPerShare(v, decimals = 2) {
  if (v == null || isNaN(v)) return '–';
  return v.toFixed(decimals) + ' ' + DISPLAY_PER_SHARE_UNIT;
}
function fmtPct(v, decimals = 1) {
  if (v == null || isNaN(v)) return '–';
  return v.toFixed(decimals) + '%';
}
function pctColor(v) { return (v == null || isNaN(v)) ? 'neutral' : v >= 0 ? 'positive' : 'negative'; }
function yoySpan(v) {
  if (v == null || isNaN(v)) return '';
  return `<span class="${pctColor(v)}">${v >= 0 ? '+' : ''}${fmtPct(v)}</span>`;
}
function numCell(v, isMargin = false) {
  if (v == null || isNaN(v)) return '<td>–</td>';
  const cls = v < 0 ? 'negative' : '';
  return `<td class="${cls}">${isMargin ? fmtPct(v) : fmtBGN(v)}</td>`;
}

// ── Currency conversion ───────────────────────────────────────────────────────
function toEUR(v, year) {
  if (v == null || isNaN(v)) return null;
  if (EUR_TRANSITION_YEAR === null) return v;  // no conversion configured
  return +year >= EUR_TRANSITION_YEAR ? v : v / BGN_PER_EUR;
}
// EPS is per-share in BGN — same conversion
const toEUR_eps = toEUR;

// ── CSV data access ───────────────────────────────────────────────────────────
function colKey(year, q) {
  const months = [3, 6, 9, 12][q - 1];
  return `Q${q} ${year} (${months}М)`;
}

/** Raw YTD value for a row at year/quarter (null if missing/empty) */
function ytdRaw(label, year, q) {
  const v = csvData[label]?.[colKey(year, q)];
  if (v === '' || v == null) return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

/** IS/CF: quarterly value = YTD diff; q=1 returns YTD(1) */
function qIS(label, year, q) {
  const curr = ytdRaw(label, year, q);
  if (q === 1) return curr;
  const prev = ytdRaw(label, year, q - 1);
  return (curr !== null && prev !== null) ? curr - prev : curr !== null ? curr : null;
}

/** BS: point-in-time — same as YTD raw */
const qBS = ytdRaw;

/** In EUR, IS/CF quarterly */
function qE(label, year, q) { return toEUR(qIS(label, year, q), year); }
/** In EUR, annual (YTD Q4) */
function aE(label, year) { return toEUR(ytdRaw(label, year, 4), year); }
/** In EUR, BS point-in-time */
function bsE(label, year, q) { return toEUR(qBS(label, year, q), year); }

// ── Share count (derived from net profit / EPS) ───────────────────────────────
const _shareCountCache = {};
function sharesForYear(year) {
  if (_shareCountCache[year]) return _shareCountCache[year];
  let np = null;
  let eps = null;
  let q = 4;
  while(q > 0) {
    np = ytdRaw(ROW.net_profit, year, q);
    eps = ytdRaw(ROW.eps, year, q);
    if(np && eps) {
      break;
    }
    --q;
  }
  if(!np || !eps) {
    np = ytdRaw(ROW.net_profit, year - 1, 4);
    eps = ytdRaw(ROW.eps, year - 1, 4);
  }
  if (np && eps && eps > 0) {
    _shareCountCache[year] = Math.round(np * 1000 / eps);
  } else {
    _shareCountCache[year] = 180000000;
  }
  return _shareCountCache[year];
}

// ── Balance helper: long-term bank loans ─────────────────────────────────────
// bank_loans_lt = nc_liab - lease_lt - nc_employee_obligations
function bankLoansLT(year, q) {
  const ncl  = ytdRaw(ROW.nc_liab,     year, q) || 0;
  const llt  = ytdRaw(ROW.lease_lt,    year, q) || 0;
  const nce  = ytdRaw(ROW.nc_employee, year, q) || 0;
  return Math.max(0, ncl - llt - nce);
}

// ── Build BS data point ───────────────────────────────────────────────────────
function bsPoint(year, q, label) {
  const bankLT = toEUR(bankLoansLT(year, q), year);
  const bankST = bsE(ROW.bank_loans, year, q) || 0;
  return {
    label,
    assets:              bsE(ROW.total_assets, year, q),
    current_assets:      bsE(ROW.curr_assets,  year, q),
    liabilities:         bsE(ROW.total_liab,   year, q),
    current_liabilities: bsE(ROW.curr_liab,    year, q),
    equity:              bsE(ROW.equity,        year, q),
    cash:                bsE(ROW.cash,          year, q),
    recv:                bsE(ROW.recv,          year, q),
    re:                  bsE(ROW.retained,      year, q),
    inventories:         bsE(ROW.inventories,   year, q),
    bank_loans:          (bankLT || 0) + (bankST || 0),
    bank_loans_st:       bankST,
    lease_st:            bsE(ROW.lease_st,      year, q),
    lease_lt:            bsE(ROW.lease_lt,      year, q),
    trade_payables:      bsE(ROW.trade_pay,     year, q),
    sourceYear: year,
  };
}

// ── Build IS/CF series data point ────────────────────────────────────────────
function isPoint(year, q, label) {
  const cfOp  = qE(ROW.cf_op,  year, q);
  const capex = qE(ROW.capex,  year, q);
  const cfInv = qE(ROW.cf_inv, year, q);
  const cfFin = qE(ROW.cf_fin, year, q);
  // Net change in cash: cash_end(q) - cash_end(q-1) [or cash_start for q=1]
  const cashQ  = ytdRaw(ROW.cash_end,   year, q);
  const cashPrev = q === 1 ? ytdRaw(ROW.cash_start, year, 1) : ytdRaw(ROW.cash_end, year, q - 1);
  const cfNet = (cashQ !== null && cashPrev !== null) ? toEUR(cashQ - cashPrev, year) : null;
  return {
    label,
    revenue:     qE(ROW.revenue,     year, q),
    net_profit:  qE(ROW.net_profit,  year, q),
    gross_profit:qE(ROW.gross_profit,year, q),
    ebit:        qE(ROW.ebit,        year, q),
    cogs:        Math.abs(qE(ROW.cogs,     year, q) ?? 0) || null,
    sellExp:     Math.abs(qE(ROW.sell_exp, year, q) ?? 0) || null,
    adminExp:    Math.abs(qE(ROW.admin_exp,year, q) ?? 0) || null,
    otherExp:    Math.abs(qE(ROW.other_exp,year, q) ?? 0) || null,
    finInc:      qE(ROW.fin_inc,  year, q),
    finExp:      Math.abs(qE(ROW.fin_exp, year, q) ?? 0) || null,
    tax:         Math.abs(qE(ROW.tax,     year, q) ?? 0) || null,
    cf_op:       cfOp,
    cf_inv:      cfInv,
    cf_fin:      cfFin,
    cf_fcf:      cfOp != null && capex != null ? cfOp + capex : null,
    cf_net:      cfNet,
    eps:         toEUR_eps(qBS(ROW.eps, year, q), year),  // EPS is already period-specific in CSV
    sourceYear:  year,
    quarter:     q,
    shareCount:  sharesForYear(year),
  };
}

// NOTE: EPS in the CSV is YTD cumulative. For quarterly EPS, compute from net profit / shares.
function qEPS(year, q) {
  const np = qE(ROW.net_profit, year, q);  // quarterly net profit in hil. EUR
  const shares = sharesForYear(year);
  if (np != null && shares > 0) return (np * 1000) / shares;
  return null;
}
function aEPS(year) {
  const np = aE(ROW.net_profit, year);  // annual net profit in hil. EUR
  const shares = sharesForYear(year);
  if (np != null && shares > 0) return (np * 1000) / shares;
  return null;
}

// ── Build series (IS/CF) data ─────────────────────────────────────────────────
function buildSeriesData() {
  const result = currentMode === 'annual' ? buildAnnualData() 
               : currentMode === 'quarterly' ? buildQuarterlyData()
               : buildLTMData();
  return result;
}

function buildAnnualData() {
  return allYears
    .filter(yr => ytdRaw(ROW.revenue, yr, 4) != null)  // Only include years with Q4 data
    .map(yr => {
      const cfOp  = aE(ROW.cf_op,  yr);
      const cfInv = aE(ROW.cf_inv, yr);
      const cfFin = aE(ROW.cf_fin, yr);
      const capex = aE(ROW.capex,  yr);
      const cashEnd   = ytdRaw(ROW.cash_end,   yr, 4);
      const cashStart = ytdRaw(ROW.cash_start, yr, 1);
      const cfNet = (cashEnd != null && cashStart != null) ? toEUR(cashEnd - cashStart, yr) : null;
      return {
        label: yr,
        revenue:      aE(ROW.revenue,     yr),
        net_profit:   aE(ROW.net_profit,  yr),
        gross_profit: aE(ROW.gross_profit,yr),
        ebit:         aE(ROW.ebit,        yr),
        cogs:     Math.abs(aE(ROW.cogs,     yr) ?? 0) || null,
        sellExp:  Math.abs(aE(ROW.sell_exp, yr) ?? 0) || null,
        adminExp: Math.abs(aE(ROW.admin_exp,yr) ?? 0) || null,
        otherExp: Math.abs(aE(ROW.other_exp,yr) ?? 0) || null,
        finInc:   aE(ROW.fin_inc, yr),
        finExp:   Math.abs(aE(ROW.fin_exp, yr) ?? 0) || null,
        tax:      Math.abs(aE(ROW.tax,     yr) ?? 0) || null,
        cf_op:  cfOp,
        cf_inv: cfInv,
        cf_fin: cfFin,
        cf_fcf: cfOp != null && capex != null ? cfOp + capex : null,
        cf_net: cfNet,
        eps:    aEPS(yr),
        sourceYear: yr,
        shareCount: sharesForYear(yr),
      };
    });
}

function buildQuarterlyData() {
  const result = [];
  for (const yr of allYears) {
    if (!activeYears.has(yr)) continue;
    for (let q = 1; q <= 4; q++) {
      if (ytdRaw(ROW.revenue, yr, q) == null) continue;
      const label = `Q${q}'${yr.slice(2)}`;
      const pt = isPoint(yr, q, label);
      pt.eps = qEPS(yr, q);
      result.push(pt);
    }
  }
  return result;
}

function buildLTMData() {
  // Get all years with Q4 data (full year data)
  const yearsWithQ4 = allYears.filter(yr => ytdRaw(ROW.revenue, yr, 4) != null);
  
  const annual = yearsWithQ4.map(yr => {
    const cfOp  = aE(ROW.cf_op,  yr);
    const cfInv = aE(ROW.cf_inv, yr);
    const cfFin = aE(ROW.cf_fin, yr);
    const capex = aE(ROW.capex,  yr);
    const cashEnd   = ytdRaw(ROW.cash_end,   yr, 4);
    const cashStart = ytdRaw(ROW.cash_start, yr, 1);
    const cfNet = (cashEnd != null && cashStart != null) ? toEUR(cashEnd - cashStart, yr) : null;
    return {
      label: yr,
      revenue:      aE(ROW.revenue,     yr),
      net_profit:   aE(ROW.net_profit,  yr),
      gross_profit: aE(ROW.gross_profit,yr),
      ebit:         aE(ROW.ebit,        yr),
      cogs:     Math.abs(aE(ROW.cogs,     yr) ?? 0) || null,
      sellExp:  Math.abs(aE(ROW.sell_exp, yr) ?? 0) || null,
      adminExp: Math.abs(aE(ROW.admin_exp,yr) ?? 0) || null,
      otherExp: Math.abs(aE(ROW.other_exp,yr) ?? 0) || null,
      finInc:   aE(ROW.fin_inc, yr),
      finExp:   Math.abs(aE(ROW.fin_exp, yr) ?? 0) || null,
      tax:      Math.abs(aE(ROW.tax,     yr) ?? 0) || null,
      cf_op: cfOp, cf_inv: cfInv, cf_fin: cfFin, cf_fcf: cfOp != null && capex != null ? cfOp + capex : null, cf_net: cfNet,
      eps: aEPS(yr), sourceYear: yr, shareCount: sharesForYear(yr),
    };
  });

  // Add LTM bar (sum of last 4 quarters)
  const allQ = [];
  for (const yr of allYears) {
    for (let q = 1; q <= 4; q++) {
      if (ytdRaw(ROW.revenue, yr, q) == null) continue;
      const label = `Q${q}'${yr.slice(2)}`;
      const pt = isPoint(yr, q, label);
      pt.eps = qEPS(yr, q);
      pt.cf_cap = qE(ROW.capex, yr, q);
      pt.labelShort = label;
      allQ.push(pt);
    }
  }
  if (allQ.length >= 4) {
    const w4 = allQ.slice(-4);
    // Skip LTM if last 4 quarters are all from the same year (would duplicate annual)
    const ltmYears = new Set(w4.map(q => q.sourceYear));
    if (ltmYears.size <= 1) {
      return annual;
    }
    const sumQ = key => {
      const vals = w4.map(q => q[key]);
      return vals.some(v => v == null) ? null : vals.reduce((a, b) => a + b, 0);
    };
    const last = w4[3];
    const cfOp = sumQ('cf_op');
    const cfInv = sumQ('cf_inv');
    const cfFin = sumQ('cf_fin');
    const cfCap = sumQ('cf_cap');
    annual.push({
      label: `LTM ${last.labelShort}`,
      revenue: sumQ('revenue'), net_profit: sumQ('net_profit'),
      gross_profit: sumQ('gross_profit'), ebit: sumQ('ebit'),
      cogs: sumQ('cogs'), sellExp: sumQ('sellExp'), adminExp: sumQ('adminExp'), otherExp: sumQ('otherExp'),
      finInc: sumQ('finInc'), finExp: sumQ('finExp'), tax: sumQ('tax'),
      cf_op: cfOp,
      cf_inv: cfInv,
      cf_fin: cfFin,
      cf_fcf: cfOp != null && cfCap != null ? cfOp + cfCap : null,
      cf_net: sumQ('cf_net'),
      eps: (() => { const vals = w4.map(q => q.eps); return vals.every(v => v != null) ? vals.reduce((a,b)=>a+b,0) : null; })(),
      sourceYear: last.sourceYear, quarter: last.quarter, shareCount: last.shareCount,
    });
  }
  return annual;
}

// ── Build balance data ────────────────────────────────────────────────────────
function buildBalanceData() {
  if (currentMode === 'annual') {
    return allYears
      .map(yr => bsPoint(yr, 4, yr))
      .filter(b => b.assets != null);
  }

  if (currentMode === 'quarterly') {
    const result = [];
    for (const yr of allYears) {
      if (!activeYears.has(yr)) continue;
      for (let q = 1; q <= 4; q++) {
        if (ytdRaw(ROW.total_assets, yr, q) == null) continue;
        result.push(bsPoint(yr, q, `Q${q}'${yr.slice(2)}`));
      }
    }
    return result;
  }

  if (currentMode === 'ltm') {
    const annual = allYears.slice(0, -1)
      .map(yr => bsPoint(yr, 4, yr))
      .filter(b => b.assets != null);
    // Latest available quarter (use year as label, not "LTM Qx'yy")
    let latest = null;
    outer: for (let yi = allYears.length - 1; yi >= 0; yi--) {
      const yr = allYears[yi];
      for (let q = 4; q >= 1; q--) {
        if (ytdRaw(ROW.total_assets, yr, q) != null) {
          latest = bsPoint(yr, q, yr);
          break outer;
        }
      }
    }
    return [...annual, ...(latest ? [latest] : [])];
  }
  return [];
}

// ── Chart colors ──────────────────────────────────────────────────────────────
const C = {
  blue:'#0090D4', blueA:'rgba(0,144,212,0.18)',
  green:'#16A34A', greenA:'rgba(22,163,74,0.18)',
  navy:'#1A2E5A', navyA:'rgba(26,46,90,0.18)',
  amber:'#D97706', amberA:'rgba(217,119,6,0.18)',
  red:'#DC2626', redA:'rgba(220,38,38,0.18)',
  gray:'#94A3B8', grayA:'rgba(148,163,184,0.18)',
  teal:'#0D9488', tealA:'rgba(13,148,136,0.18)',
  purple:'#8B5CF6', purpleA:'rgba(139,92,246,0.18)',
  pink:'#EC4899', pinkA:'rgba(236,72,153,0.18)',
  cyan:'#14B8A6', cyanA:'rgba(20,184,166,0.18)',
  lime:'#84CC16', limeA:'rgba(132,204,22,0.18)',
  indigo:'#6366F1', indigoA:'rgba(99,102,241,0.18)',
};

const BASE_OPTS = {
  responsive: true, maintainAspectRatio: false, animation: { duration: 400 },
  plugins: {
    legend: { position: 'bottom', labels: { font: { size: 11 }, boxWidth: 12, padding: 12 } },
    tooltip: { mode: 'index', intersect: false, backgroundColor: '#1E293B', titleFont: { size: 11, weight: '600' }, bodyFont: { size: 11 }, padding: 10, cornerRadius: 6 }
  },
  scales: {
    x: { grid: { display: false }, ticks: { font: { size: 10 } } },
    y: { grid: { color: '#F1F5F9' }, ticks: { font: { size: 10 } } }
  }
};

function cloneOpts(extra = {}) {
  return JSON.parse(JSON.stringify({ ...BASE_OPTS, ...extra }));
}

function mkChart(id, config) {
  const ctx = document.getElementById(id)?.getContext('2d');
  if (!ctx) return;
  if (charts[id]) charts[id].destroy();
  charts[id] = new Chart(ctx, config);
}

// ── KPI ───────────────────────────────────────────────────────────────────────
function updateKPIs(series) {
  const last = series[series.length - 1];
  const prev = series.length >= 2 ? series[series.length - 2] : null;

  document.getElementById('kpi-revenue').textContent = fmtAmountCompact(last?.revenue);
  if (prev?.revenue && last?.revenue) {
    const ch = (last.revenue - prev.revenue) / Math.abs(prev.revenue) * 100;
    document.getElementById('kpi-revenue-yoy').innerHTML = yoySpan(ch) + ' г/г';
  }
  document.getElementById('kpi-revenue-period').textContent = last?.label || '';

  document.getElementById('kpi-netprofit').textContent = fmtAmountCompact(last?.net_profit);
  if (prev?.net_profit && last?.net_profit) {
    const ch = (last.net_profit - prev.net_profit) / Math.abs(prev.net_profit) * 100;
    document.getElementById('kpi-netprofit-yoy').innerHTML = yoySpan(ch) + ' г/г';
  }
  document.getElementById('kpi-netprofit-period').textContent = last?.label || '';

  const ebitM = last?.revenue ? (last.ebit / last.revenue * 100) : null;
  document.getElementById('kpi-ebitmargin').textContent = ebitM != null ? fmtPct(ebitM) : '–';
  if (last?.ebit != null) {
    const cls = (ebitM ?? 0) >= 0 ? 'positive' : 'negative';
    document.getElementById('kpi-ebitmargin-sub').innerHTML = `<span class="${cls}">EBIT: ${fmtAmountCompact(last.ebit)}</span>`;
  }
  document.getElementById('kpi-ebitmargin-period').textContent = last?.label || '';

  // EPS
  if (currentMode === 'annual') {
    // Annual mode: use series data (which already has filtered years with Q4 data)
    const epsFromSeries = series.length > 0 ? series[series.length - 1]?.eps : null;
    const epsPrev = series.length > 1 ? series[series.length - 2]?.eps : null;
    document.getElementById('kpi-eps').textContent = epsFromSeries != null ? fmtPerShare(epsFromSeries) : '–';
    if (epsFromSeries && epsPrev) {
      const ch = (epsFromSeries - epsPrev) / Math.abs(epsPrev) * 100;
      document.getElementById('kpi-eps-yoy').innerHTML = yoySpan(ch) + ' г/г';
    } else {
      document.getElementById('kpi-eps-yoy').innerHTML = '';
    }
    document.getElementById('kpi-eps-period').textContent = series.length >= 2 
      ? `FY ${series[series.length-1]?.label} vs FY ${series[series.length-2]?.label}` 
      : (series.length === 1 ? `FY ${series[0]?.label}` : '');
  } else {
    // Quarterly/LTM mode: use EPS from series
    const epsFromSeries = series.length > 0 ? series[series.length - 1]?.eps : null;
    document.getElementById('kpi-eps').textContent = epsFromSeries != null ? fmtPerShare(epsFromSeries) : '–';
    document.getElementById('kpi-eps-yoy').innerHTML = '';
    document.getElementById('kpi-eps-period').textContent = last?.label || '';
  }
}

// ── Charts ────────────────────────────────────────────────────────────────────
function renderRevenueChart(series) {
  const opts = cloneOpts();
  opts.plugins.tooltip.callbacks = { label: ctx => ` ${ctx.dataset.label}: ${fmtAmountTooltip(ctx.parsed.y)}` };
  opts.scales.y.ticks.callback = v => fmtBGN(v);
  mkChart('chart-revenue', { type: 'bar', data: { labels: series.map(s => s.label), datasets: [
    { label: 'Приходи', data: series.map(s => s.revenue), backgroundColor: C.blueA, borderColor: C.blue, borderWidth: 1.5, borderRadius: 4 },
    { label: 'Нетна печалба', data: series.map(s => s.net_profit), backgroundColor: C.greenA, borderColor: C.green, borderWidth: 1.5, borderRadius: 4 }
  ]}, options: opts });
}

function renderMarginsChart(series) {
  const opts = cloneOpts();
  opts.plugins.tooltip.callbacks = { label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y?.toFixed(1)}%` };
  opts.scales.y.ticks.callback = v => v.toFixed(0) + '%';
  mkChart('chart-margins', { type: 'line', data: { labels: series.map(s => s.label), datasets: [
    { label: 'Брутен марж', data: series.map(s => s.revenue ? s.gross_profit/s.revenue*100 : null), borderColor: C.blue, backgroundColor: C.blueA, tension: 0.3, pointRadius: 3, borderWidth: 2, fill: false },
    { label: 'EBIT марж', data: series.map(s => s.revenue ? s.ebit/s.revenue*100 : null), borderColor: C.amber, backgroundColor: C.amberA, tension: 0.3, pointRadius: 3, borderWidth: 2, fill: false },
    { label: 'Нетен марж', data: series.map(s => s.revenue ? s.net_profit/s.revenue*100 : null), borderColor: C.green, backgroundColor: C.greenA, tension: 0.3, pointRadius: 3, borderWidth: 2, fill: false }
  ]}, options: opts });
}

function renderYoYGrowthChart(series) {
  const revG = [], npG = [];
  if (currentMode === 'annual') {
    for (let i = 0; i < series.length; i++) {
      if (i === 0) { revG.push(null); npG.push(null); continue; }
      const p = series[i-1];
      revG.push(p.revenue && series[i].revenue ? (series[i].revenue - p.revenue)/Math.abs(p.revenue)*100 : null);
      npG.push(p.net_profit && series[i].net_profit ? (series[i].net_profit - p.net_profit)/Math.abs(p.net_profit)*100 : null);
    }
  } else if (currentMode === 'quarterly') {
    for (const s of series) {
      const m = s.label.match(/Q(\d)'(\d\d)/);
      if (!m) { revG.push(null); npG.push(null); continue; }
      const qi = parseInt(m[1]);
      const yr = '20' + m[2];
      const prevYr = String(+yr - 1);
      if (!allYears.includes(prevYr)) { revG.push(null); npG.push(null); continue; }
      const pr = qE(ROW.revenue,    prevYr, qi);
      const pn = qE(ROW.net_profit, prevYr, qi);
      revG.push(pr && s.revenue  ? (s.revenue    - pr)/Math.abs(pr)*100 : null);
      npG.push (pn && s.net_profit ? (s.net_profit - pn)/Math.abs(pn)*100 : null);
    }
  } else {
    // LTM mode: first N items are annual years with Q4 data - compare with previous year
    const annualCount = series.length - (series[series.length-1]?.label?.startsWith('LTM') ? 1 : 0);
    for (let i = 0; i < series.length; i++) {
      // For LTM bar (last item), compare with previous full year
      if (i === series.length - 1 && series[i]?.label?.startsWith('LTM')) {
        const prevYearIndex = annualCount - 1;
        if (prevYearIndex >= 0 && series[prevYearIndex]) {
          revG.push(series[prevYearIndex].revenue && series[i].revenue ? (series[i].revenue - series[prevYearIndex].revenue)/Math.abs(series[prevYearIndex].revenue)*100 : null);
          npG.push(series[prevYearIndex].net_profit && series[i].net_profit ? (series[i].net_profit - series[prevYearIndex].net_profit)/Math.abs(series[prevYearIndex].net_profit)*100 : null);
        } else {
          revG.push(null); npG.push(null);
        }
      } else if (i === 0) {
        revG.push(null); npG.push(null);
      } else {
        const p = series[i-1];
        revG.push(p.revenue && series[i].revenue ? (series[i].revenue - p.revenue)/Math.abs(p.revenue)*100 : null);
        npG.push(p.net_profit && series[i].net_profit ? (series[i].net_profit - p.net_profit)/Math.abs(p.net_profit)*100 : null);
      }
    }
  }
  const opts = cloneOpts();
  opts.plugins.tooltip.callbacks = { label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y?.toFixed(1)}%` };
  opts.scales.y.ticks.callback = v => v.toFixed(0) + '%';
  mkChart('chart-yoy-growth', { type: 'line', data: { labels: series.map(s => s.label), datasets: [
    { label: 'Приходи г/г %', data: revG, borderColor: C.blue, backgroundColor: C.blueA, tension: 0.3, pointRadius: 3, borderWidth: 2, fill: false },
    { label: 'Нетна печалба г/г %', data: npG, borderColor: C.green, backgroundColor: C.greenA, tension: 0.3, pointRadius: 3, borderWidth: 2, fill: false }
  ]}, options: opts });
}

function renderExpenseBreakdownChart(series) {
  const opts = cloneOpts();
  opts.plugins.tooltip.callbacks = { label: ctx => ` ${ctx.dataset.label}: ${fmtAmountTooltip(ctx.parsed.y, true)}` };
  opts.scales.x = { stacked: true, grid: { display: false }, ticks: { font: { size: 10 } } };
  opts.scales.y = { stacked: true, grid: { color: '#F1F5F9' }, ticks: { font: { size: 10 }, callback: v => fmtBGN(Math.abs(v)) } };
  mkChart('chart-expense-breakdown', { type: 'bar', data: { labels: series.map(s => s.label), datasets: [
    { label: 'Брутна печалба', data: series.map(s => s.gross_profit), backgroundColor: C.green, borderWidth: 1 },
    { label: 'Разходи за продажби', data: series.map(s => -(s.sellExp||0)), backgroundColor: C.red, borderWidth: 1 },
    { label: 'Админ. разходи', data: series.map(s => -(s.adminExp||0)), backgroundColor: C.amber, borderWidth: 1 },
    { label: 'Други разходи', data: series.map(s => -(s.otherExp||0)), backgroundColor: C.gray, borderWidth: 1 },
    { label: 'Себестойност', data: series.map(s => -(s.cogs||0)), backgroundColor: C.navy, borderWidth: 1 }
  ]}, options: opts });
}

function renderCashflowChart(series) {
  const opts = cloneOpts();
  opts.plugins.tooltip.callbacks = { label: ctx => ` ${ctx.dataset.label}: ${fmtAmountTooltip(ctx.parsed.y)}` };
  opts.scales.y.ticks.callback = v => fmtBGN(v);
  mkChart('chart-cashflow', { type: 'bar', data: { labels: series.map(s => s.label), datasets: [
    { label: 'Оперативен CF', data: series.map(s => s.cf_op), backgroundColor: C.blueA, borderColor: C.blue, borderWidth: 1.5, borderRadius: 4 },
    { label: 'FCF', data: series.map(s => s.cf_fcf), backgroundColor: C.greenA, borderColor: C.green, borderWidth: 1.5, borderRadius: 4 },
    { label: 'Нетна промяна в пари', data: series.map(s => s.cf_net), backgroundColor: C.grayA, borderColor: C.gray, borderWidth: 1.5, borderRadius: 4 }
  ]}, options: opts });
}

function renderFCFChart(series) {
  const fcf = series.map(s => s.cf_fcf);
  const opts = cloneOpts();
  opts.plugins.tooltip.callbacks = { label: ctx => ` FCF: ${fmtAmountTooltip(ctx.parsed.y)}` };
  opts.scales.y.ticks.callback = v => fmtBGN(v);
  mkChart('chart-fcf', { type: 'bar', data: { labels: series.map(s => s.label), datasets: [{
    label: `FCF (${DISPLAY_AMOUNT_UNIT})`, data: fcf,
    backgroundColor: fcf.map(v => v != null && v >= 0 ? C.greenA : C.redA),
    borderColor: fcf.map(v => v != null && v >= 0 ? C.green : C.red),
    borderWidth: 1.5, borderRadius: 4
  }]}, options: opts });
}

function renderInterestCoverageChart(series) {
  const cov = series.map(s => (s.ebit > 0 && s.finExp > 0) ? s.ebit / s.finExp : null);
  const opts = cloneOpts();
  opts.plugins.tooltip.callbacks = { label: ctx => ` Покритие: ${ctx.parsed.y?.toFixed(1)}x` };
  opts.scales.y.ticks.callback = v => v.toFixed(0) + 'x';
  opts.scales.y.beginAtZero = true;
  mkChart('chart-interest-coverage', { type: 'bar', data: { labels: series.map(s => s.label), datasets: [{
    label: 'Покритие (x)', data: cov,
    backgroundColor: cov.map(v => v != null && v >= 1 ? C.greenA : C.redA),
    borderColor: cov.map(v => v != null && v >= 1 ? C.green : C.red),
    borderWidth: 1.5, borderRadius: 4
  }]}, options: opts });
}

function renderEarningsQualityChart(series) {
  const q = series.map(s => (s.cf_op != null && s.net_profit) ? s.cf_op / s.net_profit : null);
  const opts = cloneOpts();
  opts.plugins.tooltip.callbacks = { label: ctx => ` Качество: ${ctx.parsed.y?.toFixed(2)}x` };
  opts.scales.y.ticks.callback = v => v.toFixed(1) + 'x';
  opts.scales.y.beginAtZero = false;
  mkChart('chart-earnings-quality', { type: 'line', data: { labels: series.map(s => s.label), datasets: [{
    label: 'OCF / Нетна печалба', data: q, borderColor: C.pink, backgroundColor: C.pinkA, tension: 0.3, pointRadius: 4, borderWidth: 2, fill: false
  }]}, options: opts });
}

function renderBalanceChart(bsData) {
  const opts = cloneOpts();
  opts.plugins.tooltip.callbacks = {
    label: ctx => ` ${ctx.dataset.label}: ${fmtAmountTooltip(ctx.parsed.y)}`,
    footer: items => `Общо активи: ${fmtAmountTooltip(items.reduce((a,i)=>a+(i.parsed.y||0),0))}`
  };
  opts.scales.x = { stacked: true, grid: { display: false }, ticks: { font: { size: 10 } } };
  opts.scales.y = { stacked: true, grid: { color: '#F1F5F9' }, ticks: { font: { size: 10 }, callback: v => fmtBGN(v) } };
  mkChart('chart-balance', { type: 'bar', data: { labels: bsData.map(b => b.label), datasets: [
    { label: 'Собствен капитал', data: bsData.map(b => b.equity), backgroundColor: 'rgba(22,163,74,0.7)', borderColor: C.green, borderWidth: 1, borderRadius: { topLeft:4,topRight:4,bottomLeft:0,bottomRight:0 }, stack: 'bs' },
    { label: 'Пасиви', data: bsData.map(b => b.liabilities), backgroundColor: 'rgba(220,38,38,0.55)', borderColor: C.red, borderWidth: 1, borderRadius: 0, stack: 'bs' }
  ]}, options: opts });
}

function renderAssetGrowthChart(bsData) {
  const opts = cloneOpts();
  opts.plugins.tooltip.callbacks = { label: ctx => ` ${ctx.dataset.label}: ${fmtAmountTooltip(ctx.parsed.y)}` };
  opts.scales.y.ticks.callback = v => fmtBGN(v);
  mkChart('chart-asset-growth', { type: 'line', data: { labels: bsData.map(b => b.label), datasets: [
    { label: 'Общо активи', data: bsData.map(b => b.assets), borderColor: C.navy, backgroundColor: C.navyA, tension: 0.3, pointRadius: 3, borderWidth: 2, fill: false },
    { label: 'Собствен капитал', data: bsData.map(b => b.equity), borderColor: C.green, backgroundColor: C.greenA, tension: 0.3, pointRadius: 3, borderWidth: 2, fill: false },
    { label: 'Пари', data: bsData.map(b => b.cash), borderColor: C.teal, backgroundColor: C.tealA, tension: 0.3, pointRadius: 3, borderWidth: 2, fill: false }
  ]}, options: opts });
}

function renderNetDebtChart(bsData) {
  const netDebt = bsData.map(b => {
    const totalDebt = (b.bank_loans||0) + (b.lease_st||0) + (b.lease_lt||0);
    return totalDebt - (b.cash||0);
  });
  const deRatio = bsData.map(b => (b.equity && b.equity !== 0) ? b.liabilities/b.equity : null);
  const opts = cloneOpts();
  opts.plugins.tooltip.callbacks = { label: ctx => ctx.datasetIndex === 0 ? ` Нетен дълг: ${fmtAmountTooltip(ctx.parsed.y)}` : ` D/E: ${ctx.parsed.y?.toFixed(2)}` };
  opts.scales.y = { position: 'left', grid: { color: '#F1F5F9' }, ticks: { font: { size: 10 }, callback: v => fmtBGN(v) }, title: { display: true, text: DISPLAY_AMOUNT_UNIT, font: { size: 10 } } };
  opts.scales.y2 = { position: 'right', grid: { display: false }, ticks: { font: { size: 10 }, callback: v => v.toFixed(2) }, title: { display: true, text: 'D/E', font: { size: 10 } }, beginAtZero: true };
  mkChart('chart-net-debt', { type: 'bar', data: { labels: bsData.map(b => b.label), datasets: [
    { label: `Нетен дълг (${DISPLAY_AMOUNT_UNIT})`, data: netDebt, backgroundColor: netDebt.map(v=>v>=0?C.redA:C.greenA), borderColor: netDebt.map(v=>v>=0?C.red:C.green), borderWidth: 1.5, borderRadius: 4, yAxisID: 'y', order: 2 },
    { label: 'D/E', data: deRatio, type: 'line', borderColor: C.navy, backgroundColor: C.navyA, tension: 0.3, pointRadius: 3, borderWidth: 2, fill: false, yAxisID: 'y2', order: 1 }
  ]}, options: opts });
}

function renderLiquidityChart(bsData) {
  const opts = cloneOpts();
  opts.plugins.tooltip.callbacks = { label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y?.toFixed(2)}` };
  opts.scales.y.ticks.callback = v => v.toFixed(1);
  opts.scales.y.beginAtZero = true;
  mkChart('chart-liquidity', { type: 'line', data: { labels: bsData.map(b => b.label), datasets: [
    { label: 'Текущо съотношение', data: bsData.map(b => (b.current_assets && b.current_liabilities) ? b.current_assets/b.current_liabilities : null), borderColor: C.amber, backgroundColor: C.amberA, tension: 0.3, pointRadius: 3, borderWidth: 2, fill: false },
    { label: 'Бързо съотношение', data: bsData.map(b => (b.cash != null && b.recv != null && b.current_liabilities) ? (b.cash+b.recv)/b.current_liabilities : null), borderColor: C.teal, backgroundColor: C.tealA, tension: 0.3, pointRadius: 3, borderWidth: 2, fill: false }
  ]}, options: opts });
}

function renderDuPontChart(series, bsData) {
  const netM = series.map(s => s.revenue ? s.net_profit/s.revenue*100 : null);
  const assetTurn = series.map((s,i) => (s.revenue && bsData[i]?.assets) ? s.revenue/bsData[i].assets : null);
  const equityM = bsData.map(b => (b.assets && b.equity && b.equity !== 0) ? b.assets/b.equity : null);
  const roe = series.map((s,i) => (netM[i] != null && assetTurn[i] != null && equityM[i] != null) ? (netM[i]/100)*assetTurn[i]*equityM[i]*100 : null);
  const opts = cloneOpts();
  opts.plugins.tooltip.callbacks = { label: ctx => { const v=ctx.parsed.y; if(v==null)return''; return (ctx.datasetIndex===1||ctx.datasetIndex===2)?` ${ctx.dataset.label}: ${v.toFixed(2)}x`:` ${ctx.dataset.label}: ${v.toFixed(1)}%`; } };
  opts.scales.y = { position: 'left', grid: { color: '#F1F5F9' }, ticks: { font: { size: 10 }, callback: v => v.toFixed(0)+'%' }, title: { display: true, text: '%', font: { size: 10 } } };
  opts.scales.y2 = { position: 'right', grid: { display: false }, ticks: { font: { size: 10 }, callback: v => v.toFixed(1)+'x' }, title: { display: true, text: 'x', font: { size: 10 } } };
  mkChart('chart-dupont', { type: 'line', data: { labels: series.map(s=>s.label), datasets: [
    { label: 'Нетен марж %', data: netM, borderColor: C.red, backgroundColor: C.redA, tension: 0.3, pointRadius: 3, borderWidth: 2, fill: false, yAxisID: 'y' },
    { label: 'Оборот на активи', data: assetTurn, borderColor: C.amber, backgroundColor: C.amberA, tension: 0.3, pointRadius: 3, borderWidth: 2, fill: false, yAxisID: 'y2' },
    { label: 'Ливъридж', data: equityM, borderColor: C.purple, backgroundColor: C.purpleA, tension: 0.3, pointRadius: 3, borderWidth: 2, fill: false, yAxisID: 'y2' },
    { label: 'ROE %', data: roe, borderColor: C.green, backgroundColor: C.greenA, tension: 0.3, pointRadius: 3, borderWidth: 2, fill: false, yAxisID: 'y' }
  ]}, options: opts });
}

function renderReceivablesChart(series, bsData) {
  const df = (currentMode === 'annual' || currentMode === 'ltm') ? 365 : 90;
  const recvDays = series.map((s,i) => (s.revenue && bsData[i]?.recv != null && Math.abs(s.revenue) > 0.01) ? (bsData[i].recv / Math.abs(s.revenue)) * df : null);
  const opts = cloneOpts();
  opts.plugins.tooltip.callbacks = { label: ctx => ` ${ctx.parsed.y?.toFixed(0)} дни` };
  opts.scales.y.ticks.callback = v => v.toFixed(0)+' дни';
  opts.scales.y.beginAtZero = true;
  mkChart('chart-receivables', { type: 'line', data: { labels: series.map(s=>s.label), datasets: [{
    label: 'Вземания в дни', data: recvDays, borderColor: C.indigo, backgroundColor: C.indigoA, tension: 0.3, pointRadius: 4, borderWidth: 2, fill: false
  }]}, options: opts });
}

function renderSeasonalityChart() {
  const years = [...activeYears].sort().slice(-4);  // Last 4 selected years
  const colors = [C.blue, C.green, C.amber, C.navy, C.teal, C.purple];
  const datasets = years.map((yr, idx) => ({
    label: yr,
    data: [1,2,3,4].map(q => qE(ROW.revenue, yr, q)),
    backgroundColor: colors[idx % colors.length] + '40',
    borderColor: colors[idx % colors.length],
    borderWidth: 2, borderRadius: 4
  }));
  const opts = cloneOpts();
  opts.plugins.tooltip.callbacks = { label: ctx => ` ${ctx.dataset.label}: ${fmtAmountTooltip(ctx.parsed.y)}` };
  opts.scales.y.ticks.callback = v => fmtBGN(v);
  opts.scales.y.beginAtZero = true;
  mkChart('chart-seasonality', { type: 'bar', data: { labels: ['Q1','Q2','Q3','Q4'], datasets }, options: opts });
}

function renderWorkingCapitalChart(series, bsData) {
  const df = (currentMode === 'annual' || currentMode === 'ltm') ? 365 : 90;
  const invD = series.map((s,i) => (bsData[i]?.inventories && s.cogs && Math.abs(s.cogs) > 0.01) ? (bsData[i].inventories / Math.abs(s.cogs)) * df : null);
  const recD = series.map((s,i) => (bsData[i]?.recv && s.revenue && Math.abs(s.revenue) > 0.01) ? (bsData[i].recv / Math.abs(s.revenue)) * df : null);
  const payD = series.map((s,i) => (bsData[i]?.trade_payables && s.cogs && Math.abs(s.cogs) > 0.01) ? (bsData[i].trade_payables / Math.abs(s.cogs)) * df : null);
  const ccc  = series.map((s,i) => (invD[i] != null && recD[i] != null && payD[i] != null) ? invD[i]+recD[i]-payD[i] : null);
  const opts = cloneOpts();
  opts.plugins.tooltip.callbacks = { label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y?.toFixed(0)} дни` };
  opts.scales.y.ticks.callback = v => v.toFixed(0)+' дни';
  mkChart('chart-working-capital', { type: 'line', data: { labels: series.map(s=>s.label), datasets: [
    { label: 'Дни запаси', data: invD, borderColor: C.amber, backgroundColor: C.amberA, tension: 0.3, pointRadius: 3, borderWidth: 2, fill: false },
    { label: 'Дни вземания', data: recD, borderColor: C.blue, backgroundColor: C.blueA, tension: 0.3, pointRadius: 3, borderWidth: 2, fill: false },
    { label: 'Дни задължения', data: payD, borderColor: C.red, backgroundColor: C.redA, tension: 0.3, pointRadius: 3, borderWidth: 2, fill: false },
    { label: 'CCC (дни)', data: ccc, borderColor: C.navy, backgroundColor: C.navyA, tension: 0.3, pointRadius: 4, borderWidth: 2.5, fill: false, borderDash: [5,3] }
  ]}, options: opts });
}

function renderDividendsChart() {
  const divYears = allYears.filter(yr => {
    const v = ytdRaw(ROW.dividends, yr, 4);
    return v != null && v !== 0;
  });
  const divAbs = divYears.map(yr => {
    const v = ytdRaw(ROW.dividends, yr, 4);
    return v != null ? toEUR(Math.abs(v), yr) : 0;
  });
  const opts = cloneOpts();
  opts.plugins.tooltip.callbacks = { label: ctx => ` ${fmtAmountTooltip(ctx.parsed.y)}` };
  opts.scales.y.ticks.callback = v => fmtBGN(v);
  opts.scales.y.beginAtZero = true;
  mkChart('chart-dividends', { type: 'bar', data: { labels: divYears, datasets: [{
    label: `Дивиденти (${DISPLAY_AMOUNT_UNIT})`, data: divAbs, backgroundColor: C.greenA, borderColor: C.green, borderWidth: 1.5, borderRadius: 4
  }]}, options: opts });
}

function renderDividendPerShareChart() {
  const divYears = allYears.filter(yr => {
    const v = ytdRaw(ROW.dividends, yr, 4);
    return v != null && v !== 0;
  });
  const dps = divYears.map(yr => {
    const div = toEUR(Math.abs(ytdRaw(ROW.dividends, yr, 4) || 0), yr);
    const shares = sharesForYear(yr);
    return (div > 0 && shares > 0) ? (div * 1000) / shares : 0;
  });
  const opts = cloneOpts();
  opts.plugins.tooltip.callbacks = { label: ctx => ` ${fmtPerShare(ctx.parsed.y)}/акция` };
  opts.scales.y.ticks.callback = v => fmtPerShare(v);
  opts.scales.y.beginAtZero = true;
  mkChart('chart-dps', { type: 'bar', data: { labels: divYears, datasets: [{
    label: `Дивидент/акция (${DISPLAY_PER_SHARE_UNIT})`, data: dps, backgroundColor: C.navyA, borderColor: C.navy, borderWidth: 1.5, borderRadius: 4
  }]}, options: opts });
}

function renderPayoutRatioChart() {
  const divYears = allYears.filter(yr => {
    const v = ytdRaw(ROW.dividends, yr, 4);
    return v != null && v !== 0;
  });
  const payout = divYears.map(yr => {
    const div = toEUR(Math.abs(ytdRaw(ROW.dividends, yr, 4) || 0), yr);
    const np = aE(ROW.net_profit, yr);
    return (div > 0 && np > 0) ? div/np*100 : null;
  });
  const opts = cloneOpts();
  opts.plugins.tooltip.callbacks = { label: ctx => ` ${ctx.parsed.y?.toFixed(1)}%` };
  opts.scales.y.ticks.callback = v => v.toFixed(0)+'%';
  opts.scales.y.beginAtZero = true;
  mkChart('chart-payout', { type: 'line', data: { labels: divYears, datasets: [{
    label: 'Коефициент на изплащане %', data: payout, borderColor: C.amber, backgroundColor: C.amberA, tension: 0.3, pointRadius: 4, borderWidth: 2, fill: false
  }]}, options: opts });
}

function renderEPSvsFCFChart(series) {
  const epsData = series.map(s => s.eps);
  const fcfPS = series.map(s => (s.cf_fcf != null && s.shareCount) ? (s.cf_fcf * 1000) / s.shareCount : null);
  const opts = cloneOpts();
  opts.plugins.tooltip.callbacks = { label: ctx => ` ${ctx.dataset.label}: ${fmtPerShare(ctx.parsed.y)}` };
  opts.scales.y.ticks.callback = v => fmtPerShare(v);
  mkChart('chart-eps-fcf', { type: 'bar', data: { labels: series.map(s=>s.label), datasets: [
    { label: `EPS (${DISPLAY_PER_SHARE_UNIT})`, data: epsData, backgroundColor: C.navyA, borderColor: C.navy, borderWidth: 1.5, borderRadius: 4 },
    { label: `FCF/акция (${DISPLAY_PER_SHARE_UNIT})`, data: fcfPS, backgroundColor: C.tealA, borderColor: C.teal, borderWidth: 1.5, borderRadius: 4 }
  ]}, options: opts });
}

function renderBVPSChart(series) {
  const labels = [], values = [];
  
  if (currentMode === 'quarterly') {
    for (const yr of allYears) {
      if (!activeYears.has(yr)) continue;
      for (let q = 1; q <= 4; q++) {
        const eq = ytdRaw(ROW.equity, yr, q);
        if (eq == null) continue;
        const shares = sharesForYear(yr);
        labels.push(`Q${q}'${yr.slice(2)}`);
        values.push(toEUR((eq * 1000) / shares, yr));
      }
    }
  } else {
    // Annual or LTM mode
    for (const s of series) {
      let eq = null;
      let yr = s.sourceYear || s.label;
      
      if (s.label?.startsWith('LTM')) {
        // For LTM: get equity from the last available quarter
        for (let q = 4; q >= 1; q--) {
          eq = ytdRaw(ROW.equity, yr, q);
          if (eq != null) break;
        }
      } else {
        // For annual years: get equity from Q4
        eq = ytdRaw(ROW.equity, yr, 4);
      }
      
      if (eq == null) continue;
      const shares = s.shareCount || sharesForYear(yr);
      labels.push(s.label);
      values.push(toEUR((eq * 1000) / shares, yr));
    }
  }
  
  const opts = cloneOpts();
  opts.plugins.tooltip.callbacks = { label: ctx => ` BVPS: ${fmtPerShare(ctx.parsed.y)}` };
  opts.scales.y.ticks.callback = v => fmtPerShare(v, 1);
  mkChart('chart-bvps', { type: 'line', data: { labels, datasets: [{
    label: `BVPS (${DISPLAY_PER_SHARE_UNIT})`, data: values, borderColor: C.navy, backgroundColor: C.navyA, tension: 0.3, pointRadius: 4, borderWidth: 2, fill: true
  }]}, options: opts });
}

// ── Tables ────────────────────────────────────────────────────────────────────
function renderIncomeTable(series) {
  document.getElementById('income-thead').innerHTML =
    '<th>Показател</th>' + series.map(s => `<th>${s.label}</th>`).join('');
  const rows = [
    { key: 'revenue',     label: 'Приходи', bold: true },
    { key: 'gross_profit',label: 'Брутна печалба', bold: true },
    { key: 'ebit',        label: 'EBIT', bold: true },
    { key: 'net_profit',  label: 'Нетна печалба', bold: true, sep: true },
    { key: 'gross_margin',label: 'Брутен марж %', isMargin: true },
    { key: 'ebit_margin', label: 'EBIT марж %', isMargin: true },
    { key: 'net_margin',  label: 'Нетен марж %', isMargin: true },
  ];
  document.getElementById('income-tbody').innerHTML = rows.map(row => {
    const cls = row.sep ? 'separator' : row.isMargin ? 'margin-row' : '';
    const cells = series.map(s => {
      let v;
      if      (row.key === 'gross_margin') v = s.revenue ? s.gross_profit/s.revenue*100 : null;
      else if (row.key === 'ebit_margin')  v = s.revenue ? s.ebit/s.revenue*100 : null;
      else if (row.key === 'net_margin')   v = s.revenue ? s.net_profit/s.revenue*100 : null;
      else v = s[row.key];
      return numCell(v, row.isMargin);
    }).join('');
    const lbl = row.bold ? `<td><strong>${row.label}</strong></td>` : `<td>${row.label}</td>`;
    return `<tr class="${cls}">${lbl}${cells}</tr>`;
  }).join('');
}

function renderBalanceTable(bsData) {
  document.getElementById('balance-thead').innerHTML =
    '<th>Показател</th>' + bsData.map(b => `<th>${b.label}</th>`).join('');
  const rows = [
    { key: 'assets',      label: 'Общо активи', bold: true },
    { key: 'cash',        label: 'Пари' },
    { key: 'recv',        label: 'Търговски вземания' },
    { key: 'equity',      label: 'Собствен капитал', bold: true, sep: true },
    { key: 'liabilities', label: 'Общо пасиви' },
    { key: 'de',          label: 'D/E коефициент', isRatio: true },
  ];
  document.getElementById('balance-tbody').innerHTML = rows.map(row => {
    const cls = row.sep ? 'separator' : '';
    const cells = bsData.map(b => {
      if (row.key === 'de') {
        const v = (b.equity && b.equity !== 0) ? b.liabilities/b.equity : null;
        if (v == null) return '<td>–</td>';
        return `<td class="${v > 1 ? 'negative' : ''}">${v.toFixed(2)}</td>`;
      }
      return numCell(b[row.key], false);
    }).join('');
    const lbl = row.bold ? `<td><strong>${row.label}</strong></td>` : `<td>${row.label}</td>`;
    return `<tr class="${cls}">${lbl}${cells}</tr>`;
  }).join('');
}

function renderCashFlowTable(series) {
  let tableData;
  if (currentMode === 'annual') {
    tableData = allYears.map(yr => ({
      label: yr,
      cfOp:  aE(ROW.cf_op,  yr),
      cfInv: aE(ROW.cf_inv, yr),
      cfFin: aE(ROW.cf_fin, yr),
      cfNet: (() => { const e=ytdRaw(ROW.cash_end,yr,4),s=ytdRaw(ROW.cash_start,yr,1); return (e!=null&&s!=null)?toEUR(e-s,yr):null; })(),
      capex: aE(ROW.capex,  yr),
    }));
  } else if (currentMode === 'quarterly') {
    tableData = [];
    for (const yr of allYears) {
      if (!activeYears.has(yr)) continue;
      for (let q = 1; q <= 4; q++) {
        if (ytdRaw(ROW.cf_op, yr, q) == null) continue;
        const cashQ  = ytdRaw(ROW.cash_end, yr, q);
        const cashP  = q === 1 ? ytdRaw(ROW.cash_start, yr, 1) : ytdRaw(ROW.cash_end, yr, q-1);
        tableData.push({
          label: `Q${q}'${yr.slice(2)}`,
          cfOp:  qE(ROW.cf_op,  yr, q),
          cfInv: qE(ROW.cf_inv, yr, q),
          cfFin: qE(ROW.cf_fin, yr, q),
          cfNet: (cashQ!=null&&cashP!=null) ? toEUR(cashQ-cashP,yr) : null,
          capex: qE(ROW.capex, yr, q),
        });
      }
    }
  } else {
    // LTM mode: use series data
    tableData = series.map(s => ({ 
      label: s.label, 
      cfOp: s.cf_op, 
      cfInv: s.cf_inv, 
      cfFin: s.cf_fin, 
      cfNet: s.cf_net, 
      capex: s.cogs,  // CAPEX stored in cogs field for quarterly data
      fcfOverride: s.cf_fcf 
    }));
  }
  document.getElementById('cf-thead').innerHTML =
    '<th>Показател</th>' + tableData.map(d => `<th>${d.label}</th>`).join('');
  const rows = [
    { key: 'cfOp',  label: 'Оперативен CF', bold: true },
    { key: 'cfInv', label: 'Инвестиционен CF' },
    { key: 'cfFin', label: 'Финансов CF' },
    { key: 'cfNet', label: 'Нетна промяна', bold: true, sep: true },
    { key: 'fcf',   label: 'FCF (Опер. + CAPEX)', bold: true },
  ];
  document.getElementById('cf-tbody').innerHTML = rows.map(row => {
    const cls = row.sep ? 'separator' : '';
    const cells = tableData.map(d => {
      const v = row.key === 'fcf'
        ? (d.fcfOverride !== undefined ? d.fcfOverride : (d.cfOp != null && d.capex != null ? d.cfOp + d.capex : null))
        : d[row.key];
      return numCell(v, false);
    }).join('');
    const lbl = row.bold ? `<td><strong>${row.label}</strong></td>` : `<td>${row.label}</td>`;
    return `<tr class="${cls}">${lbl}${cells}</tr>`;
  }).join('');
}

function renderStockInfo(series) {
  let unit = 'тримесечия';
  if (currentMode === 'annual') unit = 'години';
  if (currentMode === 'ltm')    unit = 'периода';

  const infoRows = Object.entries(meta.info || {}).map(([k, v]) =>
    `<div class="info-row"><span class="info-label">${k}</span><span class="info-value">${v}</span></div>`
  ).join('');
  document.getElementById('stock-info').innerHTML = `
    <div class="info-block">
      <div class="info-block-title">Корпоративна информация</div>
      <div class="info-items">${infoRows}</div>
    </div>
    <div class="info-block">
      <div class="info-block-title">Данни за периода</div>
      <div class="info-items">
        <div class="info-row"><span class="info-label">Налични години</span><span class="info-value">${allYears.join(', ')}</span></div>
        <div class="info-row"><span class="info-label">Брой периоди</span><span class="info-value">${series.length} ${unit}</span></div>
        <div class="info-row"><span class="info-label">Валута</span><span class="info-value">${DISPLAY_AMOUNT_UNIT}</span></div>
      </div>
    </div>
  `;
}

// ── Export CSV ────────────────────────────────────────────────────────────────
function exportCSV() {
  const series  = buildSeriesData();
  const bsData  = buildBalanceData();
  const rows = [];
  rows.push(['Валута на визуализация', NO_CONVERSION ? DISPLAY_PER_SHARE_UNIT : 'EUR']);
  if (!NO_CONVERSION) rows.push(['Курс за периоди до ' + EUR_TRANSITION_YEAR, BGN_PER_EUR]);
  rows.push([]);
  rows.push(['Показател', ...series.map(s => s.label)]);
  rows.push(['--- Отчет за доходите ---']);
  rows.push(['Приходи', ...series.map(s => s.revenue)]);
  rows.push(['Брутна печалба', ...series.map(s => s.gross_profit)]);
  rows.push(['EBIT', ...series.map(s => s.ebit)]);
  rows.push(['Нетна печалба', ...series.map(s => s.net_profit)]);
  rows.push(['Брутен марж %', ...series.map(s => s.revenue ? (s.gross_profit/s.revenue*100).toFixed(1) : '')]);
  rows.push(['EBIT марж %', ...series.map(s => s.revenue ? (s.ebit/s.revenue*100).toFixed(1) : '')]);
  rows.push(['Нетен марж %', ...series.map(s => s.revenue ? (s.net_profit/s.revenue*100).toFixed(1) : '')]);
  rows.push(['--- Парични потоци ---']);
  rows.push(['Оперативен CF', ...series.map(s => s.cf_op)]);
  rows.push(['FCF', ...series.map(s => s.cf_fcf)]);
  rows.push(['Нетна промяна', ...series.map(s => s.cf_net)]);
  rows.push(['EPS', ...series.map(s => s.eps)]);
  rows.push(['--- Баланс ---']);
  rows.push(['Показател', ...bsData.map(b => b.label)]);
  rows.push(['Общо активи', ...bsData.map(b => b.assets)]);
  rows.push(['Собствен капитал', ...bsData.map(b => b.equity)]);
  rows.push(['Общо пасиви', ...bsData.map(b => b.liabilities)]);
  rows.push(['Пари', ...bsData.map(b => b.cash)]);
  rows.push(['Вземания', ...bsData.map(b => b.recv)]);
  const csv = rows.map(r => r.map(v => {
    if (v == null) return '';
    const s = String(v);
    return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g,'""')}"` : s;
  }).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  const companyId = getCompanyId();
  a.download = `${companyId}_${currentMode}_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── Refresh ───────────────────────────────────────────────────────────────────
function refresh() {
  const series = buildSeriesData();
  const bsData = buildBalanceData();
  updateKPIs(series);
  renderRevenueChart(series);
  renderMarginsChart(series);
  renderYoYGrowthChart(series);
  renderExpenseBreakdownChart(series);
  renderCashflowChart(series);
  renderFCFChart(series);
  renderInterestCoverageChart(series);
  renderEarningsQualityChart(series);
  renderBalanceChart(bsData);
  renderAssetGrowthChart(bsData);
  renderNetDebtChart(bsData);
  renderLiquidityChart(bsData);
  renderDuPontChart(series, bsData);
  renderReceivablesChart(series, bsData);
  renderSeasonalityChart();
  renderWorkingCapitalChart(series, bsData);
  renderEPSvsFCFChart(series);
  renderBVPSChart(series);
  renderDividendsChart();
  renderDividendPerShareChart();
  renderPayoutRatioChart();
  renderIncomeTable(series);
  renderBalanceTable(bsData);
  renderCashFlowTable(series);
  renderStockInfo(series);
  document.getElementById('year-filters').style.display =
    currentMode === 'quarterly' ? 'flex' : 'none';
}

function setMode(mode) {
  currentMode = mode;
  updateModeButtons();
  refresh();
}

function updateModeButtons() {
  document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.mode === currentMode));
}

function updateYearFilter() {
  activeYears = new Set();
  document.querySelectorAll('#year-filters input[type=checkbox]:checked').forEach(cb => activeYears.add(cb.value));
  refresh();
}

// ── CSV Parser ────────────────────────────────────────────────────────────────
function parseCSV(text) {
  // Handle UTF-8 BOM
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const rows = [];
  let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i+1] === '"') { field += '"'; i++; }
        else inQ = false;
      } else field += ch;
    } else if (ch === '"') {
      inQ = true;
    } else if (ch === ',') {
      row.push(field); field = '';
    } else if (ch === '\n') {
      row.push(field); field = '';
      rows.push(row); row = [];
    } else if (ch === '\r') {
      // skip
    } else {
      field += ch;
    }
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  populateCompanySelector();
  
  try {
    const companyId = getCompanyId();
    const baseUrl = `./companies/${companyId}`;

    // 1. Load company metadata
    const metaResp = await fetch(`${baseUrl}/meta.json`);
    if (!metaResp.ok) throw new Error(`meta.json not found for company: ${companyId} (HTTP ${metaResp.status})`);
    meta = await metaResp.json();
    applyMeta(meta);

    // 2. Load CSV data
    const dataFile = meta.data_file || 'data.csv';
    const csvResp = await fetch(`${baseUrl}/${dataFile}`);
    if (!csvResp.ok) throw new Error(`HTTP ${csvResp.status}`);
    const text = await csvResp.text();
    const rows = parseCSV(text);
    if (rows.length < 2) throw new Error('Empty CSV');

    // Header row: раздел, счетоводен_ред, Q1 2021 (3М), ...
    const headers = rows[0];
    // Parse period columns starting at index 2
    periods = [];
    for (let i = 2; i < headers.length; i++) {
      const m = headers[i].match(/Q(\d)\s+(\d{4})\s+\((\d+)М\)/);
      if (m) periods.push({ q: +m[1], year: m[2], months: +m[3], key: headers[i], colIdx: i });
    }

    // Filter to only include data from 2022 onwards
    periods = periods.filter(p => parseInt(p.year) >= 2022);

    // Build allYears from periods
    allYears = [...new Set(periods.map(p => p.year))].sort();

    // Build csvData lookup
    csvData = {};
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (row.length < 3) continue;
      const label = row[1];
      if (!label) continue;
      csvData[label] = {};
      for (const p of periods) {
        csvData[label][p.key] = row[p.colIdx] ?? '';
      }
    }

    // Populate year filter checkboxes dynamically
    // Default: check last 4 years
    const defaultChecked = new Set(allYears.slice(-4));
    activeYears = new Set(defaultChecked);
    const filtersDiv = document.getElementById('year-filters');
    filtersDiv.innerHTML = '<span class="controls-label">Години:</span>' +
      allYears.map(yr => {
        const checked = defaultChecked.has(yr) ? 'checked' : '';
        return `<label><input type="checkbox" value="${yr}" ${checked} onchange="updateYearFilter()"> ${yr}</label>`;
      }).join('');

    document.getElementById('loading').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';
    refresh();
    updateModeButtons();
  } catch (e) {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('error-banner').style.display = 'block';
    console.error('Failed to load company data:', e);
  }
}

init();
