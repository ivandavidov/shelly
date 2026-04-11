let D = null;
let currentMode = 'quarterly';
let activeYears = new Set(['2022','2023','2024','2025']);
const charts = {};

function fmtNum(v, decimals = 0) {
  if (v === null || v === undefined || isNaN(v)) return '–';
  return v.toLocaleString('bg-BG', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtBGN(v) {
  if (v === null || v === undefined || isNaN(v)) return '–';
  const abs = Math.abs(v);
  if (abs >= 100000) {
    const m = v / 1000;
    return (m >= 0 ? '' : '-') + Math.abs(m).toLocaleString('bg-BG', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' млн.';
  }
  return v.toLocaleString('bg-BG', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtPct(v, decimals = 1) {
  if (v === null || v === undefined || isNaN(v)) return '–';
  return v.toFixed(decimals) + '%';
}

function pctColor(v) {
  if (v === null || v === undefined || isNaN(v)) return 'neutral';
  return v >= 0 ? 'positive' : 'negative';
}

function yoySpan(v) {
  if (v === null || v === undefined || isNaN(v)) return '';
  const cls = pctColor(v);
  const sign = v >= 0 ? '+' : '';
  return `<span class="${cls}">${sign}${fmtPct(v)}</span>`;
}

function numCell(v, isMargin = false) {
  if (v === null || v === undefined || isNaN(v)) return '<td>–</td>';
  const cls = v < 0 ? 'negative' : '';
  const text = isMargin ? fmtPct(v) : fmtBGN(v);
  return `<td class="${cls}">${text}</td>`;
}

const YEARS = ['2021','2022','2023','2024','2025'];

function getQuarterly(item, year) {
  const key = year === '2024' ? 'quarterly_2024' : `quarterly_${year}`;
  return item[key] || [null,null,null,null];
}

function getYTD(item, year) {
  const key = year === '2024' ? 'ytd_2024' : `ytd_${year}`;
  return item[key] || [null,null,null,null];
}

function buildSeriesData() {
  const IS = D.income_statement.items;
  const CF = D.cash_flows.items;

  if (currentMode === 'annual') {
    return YEARS.map(yr => {
      const rev = getYTD(IS.revenue, yr)[3];
      const np  = getYTD(IS.net_profit, yr)[3];
      const gp  = getYTD(IS.gross_profit, yr)[3];
      const eb  = getYTD(IS.ebit, yr)[3];
      const cogs = Math.abs(getYTD(IS.cogs, yr)[3]);
      const sellExp = Math.abs(getYTD(IS.selling_expenses, yr)[3]);
      const adminExp = Math.abs(getYTD(IS.admin_expenses, yr)[3]);
      const otherExp = Math.abs(getYTD(IS.other_operating_expenses, yr)[3]);
      const finInc = getYTD(IS.financial_income, yr)[3];
      const finExp = Math.abs(getYTD(IS.financial_expenses, yr)[3]);
      const tax = Math.abs(getYTD(IS.tax, yr)[3]);
      const cfOp = CF.operating.total[`ytd_${yr}`]?.[3] ?? null;
      const cfCap = CF.investing.capex[`ytd_${yr}`]?.[3] ?? null;
      const cfNet = CF.summary.net_change[`ytd_${yr}`]?.[3] ?? null;
      const eps = D.per_share.eps_ytd[`ytd_${yr}`]?.[3] ?? null;
      return { 
        label: yr, revenue: rev, net_profit: np, gross_profit: gp, ebit: eb,
        cogs, sellExp, adminExp, otherExp, finInc, finExp, tax,
        cf_op: cfOp, cf_fcf: (cfOp !== null && cfCap !== null ? cfOp + cfCap : null), cf_net: cfNet, eps
      };
    });
  }

  if (currentMode === 'quarterly') {
    const result = [];
    for (const yr of YEARS) {
      if (!activeYears.has(yr)) continue;
      const revQ  = getQuarterly(IS.revenue, yr);
      const npQ   = getQuarterly(IS.net_profit, yr);
      const gpQ   = getQuarterly(IS.gross_profit, yr);
      const ebQ   = getQuarterly(IS.ebit, yr);
      const cogsQ = getQuarterly(IS.cogs, yr).map(v => Math.abs(v));
      const sellQ = getQuarterly(IS.selling_expenses, yr).map(v => Math.abs(v));
      const adminQ = getQuarterly(IS.admin_expenses, yr).map(v => Math.abs(v));
      const otherQ = getQuarterly(IS.other_operating_expenses, yr).map(v => Math.abs(v));
      const finIncQ = getQuarterly(IS.financial_income, yr);
      const finExpQ = getQuarterly(IS.financial_expenses, yr).map(v => Math.abs(v));
      const taxQ = getQuarterly(IS.tax, yr).map(v => Math.abs(v));
      const cfOpQ = CF.operating.total[`quarterly_${yr}`] || [null,null,null,null];
      const cfCapYTD = CF.investing.capex[`ytd_${yr}`] || [null,null,null,null];
      const cfCapQ = [
        cfCapYTD[0],
        cfCapYTD[1] !== null && cfCapYTD[0] !== null ? cfCapYTD[1] - cfCapYTD[0] : null,
        cfCapYTD[2] !== null && cfCapYTD[1] !== null ? cfCapYTD[2] - cfCapYTD[1] : null,
        cfCapYTD[3] !== null && cfCapYTD[2] !== null ? cfCapYTD[3] - cfCapYTD[2] : null,
      ];
      const cfNetQ = CF.summary.net_change[`quarterly_${yr}`] || [null,null,null,null];
      const epsQ = D.per_share.eps_quarterly?.[`quarterly_${yr}`] || null;
      const qLabels = ['Q1','Q2','Q3','Q4'];
      for (let i = 0; i < 4; i++) {
        result.push({
          label: `${qLabels[i]}'${yr.slice(2)}`, yr,
          revenue: revQ[i], net_profit: npQ[i], gross_profit: gpQ[i], ebit: ebQ[i],
          cogs: cogsQ[i], sellExp: sellQ[i], adminExp: adminQ[i], otherExp: otherQ[i],
          finInc: finIncQ[i], finExp: finExpQ[i], tax: taxQ[i],
          cf_op: cfOpQ[i],
          cf_fcf: cfOpQ[i] !== null && cfCapQ[i] !== null ? cfOpQ[i] + cfCapQ[i] : null,
          cf_net: cfNetQ[i],
          eps: epsQ ? epsQ[i] : null
        });
      }
    }
    return result;
  }

  if (currentMode === 'ltm') {
    // Annual bars for all years except the last
    const annualYears = YEARS.slice(0, -1);
    const result = annualYears.map(yr => {
      const rev = getYTD(IS.revenue, yr)[3];
      const np  = getYTD(IS.net_profit, yr)[3];
      const gp  = getYTD(IS.gross_profit, yr)[3];
      const eb  = getYTD(IS.ebit, yr)[3];
      const cogs    = Math.abs(getYTD(IS.cogs, yr)[3] ?? 0);
      const sellExp = Math.abs(getYTD(IS.selling_expenses, yr)[3] ?? 0);
      const adminExp = Math.abs(getYTD(IS.admin_expenses, yr)[3] ?? 0);
      const otherExp = Math.abs(getYTD(IS.other_operating_expenses, yr)[3] ?? 0);
      const finInc  = getYTD(IS.financial_income, yr)[3];
      const finExp  = Math.abs(getYTD(IS.financial_expenses, yr)[3] ?? 0);
      const tax     = Math.abs(getYTD(IS.tax, yr)[3] ?? 0);
      const cfOp  = CF.operating.total[`ytd_${yr}`]?.[3] ?? null;
      const cfCap = CF.investing.capex[`ytd_${yr}`]?.[3] ?? null;
      const cfNet = CF.summary.net_change[`ytd_${yr}`]?.[3] ?? null;
      const eps   = D.per_share.eps_ytd[`ytd_${yr}`]?.[3] ?? null;
      return {
        label: yr, revenue: rev, net_profit: np, gross_profit: gp, ebit: eb,
        cogs, sellExp, adminExp, otherExp, finInc, finExp, tax,
        cf_op: cfOp, cf_fcf: (cfOp !== null && cfCap !== null ? cfOp + cfCap : null), cf_net: cfNet, eps
      };
    });

    // Single LTM bar: sum of last 4 available quarters
    const allQ = [];
    for (const yr of YEARS) {
      const revQ    = getQuarterly(IS.revenue, yr);
      const npQ     = getQuarterly(IS.net_profit, yr);
      const gpQ     = getQuarterly(IS.gross_profit, yr);
      const ebQ     = getQuarterly(IS.ebit, yr);
      const cogsQ   = getQuarterly(IS.cogs, yr).map(v => Math.abs(v ?? 0));
      const sellQ   = getQuarterly(IS.selling_expenses, yr).map(v => Math.abs(v ?? 0));
      const adminQ  = getQuarterly(IS.admin_expenses, yr).map(v => Math.abs(v ?? 0));
      const otherQ  = getQuarterly(IS.other_operating_expenses, yr).map(v => Math.abs(v ?? 0));
      const finIncQ = getQuarterly(IS.financial_income, yr);
      const finExpQ = getQuarterly(IS.financial_expenses, yr).map(v => Math.abs(v ?? 0));
      const taxQ    = getQuarterly(IS.tax, yr).map(v => Math.abs(v ?? 0));
      const cfOpQ   = CF.operating.total[`quarterly_${yr}`] || [null,null,null,null];
      const cfCapYTD = CF.investing.capex[`ytd_${yr}`] || [null,null,null,null];
      const cfCapQ  = [
        cfCapYTD[0],
        cfCapYTD[1] !== null && cfCapYTD[0] !== null ? cfCapYTD[1] - cfCapYTD[0] : null,
        cfCapYTD[2] !== null && cfCapYTD[1] !== null ? cfCapYTD[2] - cfCapYTD[1] : null,
        cfCapYTD[3] !== null && cfCapYTD[2] !== null ? cfCapYTD[3] - cfCapYTD[2] : null,
      ];
      const cfNetQ  = CF.summary.net_change[`quarterly_${yr}`] || [null,null,null,null];
      const epsQ    = D.per_share.eps_quarterly?.[`quarterly_${yr}`] || null;
      for (let i = 0; i < 4; i++) {
        if (revQ[i] !== null) {
          allQ.push({
            labelShort: `Q${i+1}'${yr.slice(2)}`, yr, qi: i,
            revenue: revQ[i], net_profit: npQ[i], gross_profit: gpQ[i], ebit: ebQ[i],
            cogs: cogsQ[i], sellExp: sellQ[i], adminExp: adminQ[i], otherExp: otherQ[i],
            finInc: finIncQ[i], finExp: finExpQ[i], tax: taxQ[i],
            cf_op: cfOpQ[i], cf_cap: cfCapQ[i], cf_net: cfNetQ[i],
            eps: epsQ ? epsQ[i] : null
          });
        }
      }
    }
    if (allQ.length >= 4) {
      const w4 = allQ.slice(-4);
      const sumQ = key => {
        const vals = w4.map(q => q[key]);
        return vals.some(v => v === null) ? null : vals.reduce((a, b) => a + b, 0);
      };
      const last = w4[3];
      const cfOp = sumQ('cf_op');
      const cfCap = sumQ('cf_cap');
      result.push({
        label: `LTM ${last.labelShort}`,
        revenue: sumQ('revenue'), net_profit: sumQ('net_profit'),
        gross_profit: sumQ('gross_profit'), ebit: sumQ('ebit'),
        cogs: sumQ('cogs'), sellExp: sumQ('sellExp'), adminExp: sumQ('adminExp'), otherExp: sumQ('otherExp'),
        finInc: sumQ('finInc'), finExp: sumQ('finExp'), tax: sumQ('tax'),
        cf_op: cfOp,
        cf_fcf: cfOp !== null && cfCap !== null ? cfOp + cfCap : null,
        cf_net: sumQ('cf_net'),
        eps: (() => { const vals = w4.map(q => q.eps); return vals.every(v => v !== null) ? vals.reduce((a,b)=>a+b,0) : null; })()
      });
    }
    return result;
  }
  return [];
}

function extractBSPoint(bs, i) {
  const lc = bs.liabilities.current;
  const lnc = bs.liabilities.non_current;
  const bankLoansSt = (lc.bank_loans || lc.bank_loans_st || {}).values?.[i] || 0;
  const bankLoansLt = (lnc.bank_loans_lt || {}).values?.[i] || 0;
  const leaseSt = lc.lease_st?.values?.[i] || 0;
  const leaseLt = lnc.lease_lt?.values?.[i] || 0;
  return {
    assets: bs.assets.total.values[i],
    current_assets: bs.assets.current.total.values[i],
    liabilities: bs.liabilities.total.values[i],
    current_liabilities: lc.total.values[i],
    equity: bs.equity.total.values[i],
    cash: bs.assets.current.cash.values[i],
    recv: bs.assets.current.trade_receivables.values[i],
    re: bs.equity.retained_earnings.values[i],
    inventories: bs.assets.current.inventories?.values?.[i] || 0,
    bank_loans: bankLoansSt + bankLoansLt,
    bank_loans_st: bankLoansSt,
    lease_st: leaseSt,
    lease_lt: leaseLt,
    trade_payables: lc.trade_payables?.values?.[i] || 0,
  };
}

function buildBalanceData() {
  const bs21 = D.balance_sheet_2021;
  const bs22 = D.balance_sheet_2022;
  const bs23 = D.balance_sheet_2023;
  const bs24 = D.balance_sheet_2024_original;
  const bs25 = D.balance_sheet;

  if (currentMode === 'annual') {
    return [
      ...(bs21 ? [{ label: '2021', ...extractBSPoint(bs21, 4) }] : []),
      { label: '2022', ...extractBSPoint(bs22, 4) },
      { label: '2023', ...extractBSPoint(bs23, 4) },
      { label: '2024', ...extractBSPoint(bs24, 4) },
      { label: '2025', ...extractBSPoint(bs25, 4) },
    ];
  }

  if (currentMode === 'quarterly') {
    const result = [];
    const quarters = [
      ...(activeYears.has('2021') && bs21 ? [
        { label: "Q1'21", bs: bs21, i: 1 },
        { label: "Q2'21", bs: bs21, i: 2 },
        { label: "Q3'21", bs: bs21, i: 3 },
        { label: "Q4'21", bs: bs21, i: 4 }
      ] : []),
      ...(activeYears.has('2022') ? [
        { label: "Q1'22", bs: bs22, i: 1 }, { label: "Q2'22", bs: bs22, i: 2 },
        { label: "Q3'22", bs: bs22, i: 3 }, { label: "Q4'22", bs: bs22, i: 4 }
      ] : []),
      ...(activeYears.has('2023') ? [
        { label: "Q1'23", bs: bs23, i: 1 }, { label: "Q2'23", bs: bs23, i: 2 },
        { label: "Q3'23", bs: bs23, i: 3 }, { label: "Q4'23", bs: bs23, i: 4 }
      ] : []),
      ...(activeYears.has('2024') ? [
        { label: "Q1'24", bs: bs24, i: 1 }, { label: "Q2'24", bs: bs24, i: 2 },
        { label: "Q3'24", bs: bs24, i: 3 }, { label: "Q4'24", bs: bs24, i: 4 }
      ] : []),
      ...(activeYears.has('2025') ? [
        { label: "Q1'25", bs: bs25, i: 1 }, { label: "Q2'25", bs: bs25, i: 2 },
        { label: "Q3'25", bs: bs25, i: 3 }, { label: "Q4'25", bs: bs25, i: 4 }
      ] : []),
    ];
    for (const q of quarters) {
      result.push({ label: q.label, ...extractBSPoint(q.bs, q.i) });
    }
    return result;
  }

  if (currentMode === 'ltm') {
    // Annual year-end snapshots for 2021–2024
    const annual = [
      ...(bs21 ? [{ label: '2021', bs: bs21, i: 4 }] : []),
      { label: '2022', bs: bs22, i: 4 },
      { label: '2023', bs: bs23, i: 4 },
      { label: '2024', bs: bs24, i: 4 },
    ];
    // Latest available quarter snapshot (from bs25, or fall back to bs24)
    const candidates = [
      { label: "Q4'25", bs: bs25, i: 4 },
      { label: "Q3'25", bs: bs25, i: 3 },
      { label: "Q2'25", bs: bs25, i: 2 },
      { label: "Q1'25", bs: bs25, i: 1 },
      { label: "Q4'24", bs: bs24, i: 4 },
    ];
    const latestBS = candidates.find(c => c.bs?.assets?.total?.values?.[c.i] != null);
    return [
      ...annual.map(q => ({ label: q.label, ...extractBSPoint(q.bs, q.i) })),
      ...(latestBS ? [{ label: `LTM ${latestBS.label}`, ...extractBSPoint(latestBS.bs, latestBS.i) }] : [])
    ];
  }
  return [];
}

const CHART_COLORS = {
  blue:    '#0090D4',
  blueA:   'rgba(0,144,212,0.18)',
  green:   '#16A34A',
  greenA:  'rgba(22,163,74,0.18)',
  navy:    '#1A2E5A',
  navyA:   'rgba(26,46,90,0.18)',
  amber:   '#D97706',
  amberA:  'rgba(217,119,6,0.18)',
  red:     '#DC2626',
  redA:    'rgba(220,38,38,0.18)',
  gray:    '#94A3B8',
  grayA:   'rgba(148,163,184,0.18)',
  teal:    '#0D9488',
  tealA:   'rgba(13,148,136,0.18)',
  purple:  '#8B5CF6',
  purpleA: 'rgba(139,92,246,0.18)',
  pink:    '#EC4899',
  pinkA:   'rgba(236,72,153,0.18)',
  cyan:    '#14B8A6',
  cyanA:   'rgba(20,184,166,0.18)',
  lime:    '#84CC16',
  limeA:   'rgba(132,204,22,0.18)',
  indigo:  '#6366F1',
  indigoA: 'rgba(99,102,241,0.18)',
};

const BASE_CHART_OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 400 },
  plugins: {
    legend: { position: 'bottom', labels: { font: { size: 11 }, boxWidth: 12, padding: 12 } },
    tooltip: {
      mode: 'index',
      intersect: false,
      backgroundColor: '#1E293B',
      titleFont: { size: 11, weight: '600' },
      bodyFont: { size: 11 },
      padding: 10,
      cornerRadius: 6,
    }
  },
  scales: {
    x: { grid: { display: false }, ticks: { font: { size: 10 } } },
    y: { grid: { color: '#F1F5F9' }, ticks: { font: { size: 10 } } }
  }
};

function mkChart(id, config) {
  const ctx = document.getElementById(id).getContext('2d');
  if (charts[id]) charts[id].destroy();
  charts[id] = new Chart(ctx, config);
  return charts[id];
}

function updateKPIs(series) {
  const last = series[series.length - 1];
  const prev = series.length >= 2 ? series[series.length - 2] : null;

  document.getElementById('kpi-revenue').textContent = fmtBGN(last?.revenue);
  if (prev && prev.revenue && last.revenue) {
    const ch = (last.revenue - prev.revenue) / Math.abs(prev.revenue) * 100;
    document.getElementById('kpi-revenue-yoy').innerHTML = yoySpan(ch) + ' г/г';
  }
  document.getElementById('kpi-revenue-period').textContent = last?.label || '';

  document.getElementById('kpi-netprofit').textContent = fmtBGN(last?.net_profit);
  if (prev && prev.net_profit && last.net_profit) {
    const ch = (last.net_profit - prev.net_profit) / Math.abs(prev.net_profit) * 100;
    document.getElementById('kpi-netprofit-yoy').innerHTML = yoySpan(ch) + ' г/г';
  }
  document.getElementById('kpi-netprofit-period').textContent = last?.label || '';

  const ebitM = last && last.revenue ? (last.ebit / last.revenue * 100) : null;
  document.getElementById('kpi-ebitmargin').textContent = ebitM !== null ? fmtPct(ebitM) : '–';
  if (last && last.revenue && last.ebit !== null) {
    const cls = ebitM >= 0 ? 'positive' : 'negative';
    document.getElementById('kpi-ebitmargin-sub').innerHTML = `<span class="${cls}">EBIT: ${fmtBGN(last.ebit)}</span>`;
  }
  document.getElementById('kpi-ebitmargin-period').textContent = last?.label || '';

  const eps25 = D.per_share.eps_ytd.ytd_2025[3];
  const eps24 = D.per_share.eps_ytd.ytd_2024[3];
  document.getElementById('kpi-eps').textContent = eps25 !== null ? eps25.toFixed(2) + ' лв.' : '–';
  if (eps25 && eps24) {
    const ch = (eps25 - eps24) / Math.abs(eps24) * 100;
    document.getElementById('kpi-eps-yoy').innerHTML = yoySpan(ch) + ' г/г';
  }
  document.getElementById('kpi-eps-period').textContent = 'FY 2025 vs FY 2024';
}

function renderRevenueChart(series) {
  const labels = series.map(s => s.label);
  const revenues = series.map(s => s.revenue);
  const profits = series.map(s => s.net_profit);

  mkChart('chart-revenue', {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Приходи', data: revenues, backgroundColor: CHART_COLORS.blueA, borderColor: CHART_COLORS.blue, borderWidth: 1.5, borderRadius: 4 },
        { label: 'Нетна печалба', data: profits, backgroundColor: CHART_COLORS.greenA, borderColor: CHART_COLORS.green, borderWidth: 1.5, borderRadius: 4 }
      ]
    },
    options: {
      ...JSON.parse(JSON.stringify(BASE_CHART_OPTIONS)),
      plugins: {
        ...JSON.parse(JSON.stringify(BASE_CHART_OPTIONS.plugins)),
        tooltip: { ...JSON.parse(JSON.stringify(BASE_CHART_OPTIONS.plugins.tooltip)), callbacks: { label: ctx => ` ${ctx.dataset.label}: ${fmtBGN(ctx.parsed.y)} хил.` } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 } } },
        y: { grid: { color: '#F1F5F9' }, ticks: { font: { size: 10 }, callback: v => fmtBGN(v) } }
      }
    }
  });
}

function renderMarginsChart(series) {
  const labels = series.map(s => s.label);
  const grossM = series.map(s => s.revenue ? (s.gross_profit / s.revenue * 100) : null);
  const ebitM  = series.map(s => s.revenue ? (s.ebit / s.revenue * 100) : null);
  const netM   = series.map(s => s.revenue ? (s.net_profit / s.revenue * 100) : null);

  mkChart('chart-margins', {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Брутен марж', data: grossM, borderColor: CHART_COLORS.blue, backgroundColor: CHART_COLORS.blueA, tension: 0.3, pointRadius: 3, borderWidth: 2, fill: false },
        { label: 'EBIT марж', data: ebitM, borderColor: CHART_COLORS.amber, backgroundColor: CHART_COLORS.amberA, tension: 0.3, pointRadius: 3, borderWidth: 2, fill: false },
        { label: 'Нетен марж', data: netM, borderColor: CHART_COLORS.green, backgroundColor: CHART_COLORS.greenA, tension: 0.3, pointRadius: 3, borderWidth: 2, fill: false }
      ]
    },
    options: {
      ...JSON.parse(JSON.stringify(BASE_CHART_OPTIONS)),
      plugins: {
        ...JSON.parse(JSON.stringify(BASE_CHART_OPTIONS.plugins)),
        tooltip: { ...JSON.parse(JSON.stringify(BASE_CHART_OPTIONS.plugins.tooltip)), callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y?.toFixed(1)}%` } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 } } },
        y: { grid: { color: '#F1F5F9' }, ticks: { font: { size: 10 }, callback: v => v.toFixed(0) + '%' } }
      }
    }
  });
}

function renderExpenseBreakdownChart(series) {
  const labels = series.map(s => s.label);
  mkChart('chart-expense-breakdown', {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Брутна печалба', data: series.map(s => s.gross_profit), backgroundColor: CHART_COLORS.green, borderWidth: 1 },
        { label: 'Разходи за продажби', data: series.map(s => -s.sellExp), backgroundColor: CHART_COLORS.red, borderWidth: 1 },
        { label: 'Админ. разходи', data: series.map(s => -s.adminExp), backgroundColor: CHART_COLORS.amber, borderWidth: 1 },
        { label: 'Други разходи', data: series.map(s => -s.otherExp), backgroundColor: CHART_COLORS.gray, borderWidth: 1 },
        { label: 'Себестойност', data: series.map(s => -s.cogs), backgroundColor: CHART_COLORS.navy, borderWidth: 1 }
      ]
    },
    options: {
      ...JSON.parse(JSON.stringify(BASE_CHART_OPTIONS)),
      plugins: {
        ...JSON.parse(JSON.stringify(BASE_CHART_OPTIONS.plugins)),
        tooltip: { ...JSON.parse(JSON.stringify(BASE_CHART_OPTIONS.plugins.tooltip)), callbacks: { label: ctx => ` ${ctx.dataset.label}: ${fmtBGN(Math.abs(ctx.parsed.y))} хил.` } }
      },
      scales: {
        x: { stacked: true, grid: { display: false }, ticks: { font: { size: 10 } } },
        y: { stacked: true, grid: { color: '#F1F5F9' }, ticks: { font: { size: 10 }, callback: v => fmtBGN(Math.abs(v)) } }
      }
    }
  });
}

function renderCashflowChart(series) {
  const labels = series.map(s => s.label);
  mkChart('chart-cashflow', {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Оперативен CF', data: series.map(s => s.cf_op), backgroundColor: CHART_COLORS.blueA, borderColor: CHART_COLORS.blue, borderWidth: 1.5, borderRadius: 4 },
        { label: 'FCF', data: series.map(s => s.cf_fcf), backgroundColor: CHART_COLORS.greenA, borderColor: CHART_COLORS.green, borderWidth: 1.5, borderRadius: 4 },
        { label: 'Нетна промяна в пари', data: series.map(s => s.cf_net), backgroundColor: CHART_COLORS.grayA, borderColor: CHART_COLORS.gray, borderWidth: 1.5, borderRadius: 4 },
      ]
    },
    options: {
      ...JSON.parse(JSON.stringify(BASE_CHART_OPTIONS)),
      plugins: {
        ...JSON.parse(JSON.stringify(BASE_CHART_OPTIONS.plugins)),
        tooltip: { ...JSON.parse(JSON.stringify(BASE_CHART_OPTIONS.plugins.tooltip)), callbacks: { label: ctx => ` ${ctx.dataset.label}: ${fmtBGN(ctx.parsed.y)} хил.` } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 } } },
        y: { grid: { color: '#F1F5F9' }, ticks: { font: { size: 10 }, callback: v => fmtBGN(v) } }
      }
    }
  });
}

function renderFCFChart(series) {
  const labels = series.map(s => s.label);
  const fcf = series.map(s => s.cf_fcf);
  const avg = fcf.filter(v => v !== null).reduce((a,b) => a+b, 0) / fcf.filter(v => v !== null).length;
  
  mkChart('chart-fcf', {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'FCF (хил. BGN)',
        data: fcf,
        backgroundColor: fcf.map(v => v !== null && v >= 0 ? CHART_COLORS.greenA : CHART_COLORS.redA),
        borderColor: fcf.map(v => v !== null && v >= 0 ? CHART_COLORS.green : CHART_COLORS.red),
        borderWidth: 1.5,
        borderRadius: 4
      }]
    },
    options: {
      ...JSON.parse(JSON.stringify(BASE_CHART_OPTIONS)),
      plugins: {
        ...JSON.parse(JSON.stringify(BASE_CHART_OPTIONS.plugins)),
        tooltip: { ...JSON.parse(JSON.stringify(BASE_CHART_OPTIONS.plugins.tooltip)), callbacks: { label: ctx => ` FCF: ${fmtBGN(ctx.parsed.y)} хил.` } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 } } },
        y: { grid: { color: '#F1F5F9' }, ticks: { font: { size: 10 }, callback: v => fmtBGN(v) } }
      }
    }
  });
}

function renderInterestCoverageChart(series) {
  const labels = series.map(s => s.label);
  const coverage = series.map(s => {
    if (s.ebit === null || s.ebit <= 0) return null;
    const finExp = s.finExp || 0;
    if (finExp <= 0) return null;
    return s.ebit / finExp;
  });

  mkChart('chart-interest-coverage', {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Покритие (x)',
        data: coverage,
        backgroundColor: coverage.map(v => v !== null && v >= 1 ? CHART_COLORS.greenA : CHART_COLORS.redA),
        borderColor: coverage.map(v => v !== null && v >= 1 ? CHART_COLORS.green : CHART_COLORS.red),
        borderWidth: 1.5,
        borderRadius: 4
      }]
    },
    options: {
      ...JSON.parse(JSON.stringify(BASE_CHART_OPTIONS)),
      plugins: {
        ...JSON.parse(JSON.stringify(BASE_CHART_OPTIONS.plugins)),
        tooltip: { ...JSON.parse(JSON.stringify(BASE_CHART_OPTIONS.plugins.tooltip)), callbacks: { label: ctx => ` Покритие: ${ctx.parsed.y?.toFixed(1)}x` } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 } } },
        y: { grid: { color: '#F1F5F9' }, ticks: { font: { size: 10 }, callback: v => v.toFixed(0) + 'x' }, beginAtZero: true }
      }
    }
  });
}

function renderEarningsQualityChart(series) {
  const labels = series.map(s => s.label);
  const quality = series.map(s => {
    if (s.cf_op === null || s.net_profit === null || s.net_profit === 0) return null;
    return s.cf_op / s.net_profit;
  });

  mkChart('chart-earnings-quality', {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'OCF / Нетна печалба',
        data: quality,
        borderColor: CHART_COLORS.pink,
        backgroundColor: CHART_COLORS.pinkA,
        tension: 0.3,
        pointRadius: 4,
        borderWidth: 2,
        fill: false
      }]
    },
    options: {
      ...JSON.parse(JSON.stringify(BASE_CHART_OPTIONS)),
      plugins: {
        ...JSON.parse(JSON.stringify(BASE_CHART_OPTIONS.plugins)),
        tooltip: { ...JSON.parse(JSON.stringify(BASE_CHART_OPTIONS.plugins.tooltip)), callbacks: { label: ctx => ` Качество: ${ctx.parsed.y?.toFixed(2)}x` } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 } } },
        y: { grid: { color: '#F1F5F9' }, ticks: { font: { size: 10 }, callback: v => v.toFixed(1) + 'x' }, beginAtZero: false }
      }
    }
  });
}

function renderBalanceChart(bsData) {
  const labels = bsData.map(b => b.label);
  mkChart('chart-balance', {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Собствен капитал', data: bsData.map(b => b.equity), backgroundColor: 'rgba(22,163,74,0.7)', borderColor: CHART_COLORS.green, borderWidth: 1, borderRadius: { topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0 }, stack: 'bs' },
        { label: 'Пасиви', data: bsData.map(b => b.liabilities), backgroundColor: 'rgba(220,38,38,0.55)', borderColor: CHART_COLORS.red, borderWidth: 1, borderRadius: 0, stack: 'bs' }
      ]
    },
    options: {
      ...JSON.parse(JSON.stringify(BASE_CHART_OPTIONS)),
      plugins: {
        ...JSON.parse(JSON.stringify(BASE_CHART_OPTIONS.plugins)),
        tooltip: { ...JSON.parse(JSON.stringify(BASE_CHART_OPTIONS.plugins.tooltip)), callbacks: { label: ctx => ` ${ctx.dataset.label}: ${fmtBGN(ctx.parsed.y)} хил.`, footer: items => `Общо активи: ${fmtBGN(items.reduce((a,i) => a+(i.parsed.y||0), 0))} хил.` } }
      },
      scales: {
        x: { stacked: true, grid: { display: false }, ticks: { font: { size: 10 } } },
        y: { stacked: true, grid: { color: '#F1F5F9' }, ticks: { font: { size: 10 }, callback: v => fmtBGN(v) } }
      }
    }
  });
}

function renderAssetGrowthChart(bsData) {
  const labels = bsData.map(b => b.label);
  mkChart('chart-asset-growth', {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Общо активи', data: bsData.map(b => b.assets), borderColor: CHART_COLORS.navy, backgroundColor: CHART_COLORS.navyA, tension: 0.3, pointRadius: 3, borderWidth: 2, fill: false },
        { label: 'Собствен капитал', data: bsData.map(b => b.equity), borderColor: CHART_COLORS.green, backgroundColor: CHART_COLORS.greenA, tension: 0.3, pointRadius: 3, borderWidth: 2, fill: false },
        { label: 'Пари', data: bsData.map(b => b.cash), borderColor: CHART_COLORS.teal, backgroundColor: CHART_COLORS.tealA, tension: 0.3, pointRadius: 3, borderWidth: 2, fill: false }
      ]
    },
    options: {
      ...JSON.parse(JSON.stringify(BASE_CHART_OPTIONS)),
      plugins: {
        ...JSON.parse(JSON.stringify(BASE_CHART_OPTIONS.plugins)),
        tooltip: { ...JSON.parse(JSON.stringify(BASE_CHART_OPTIONS.plugins.tooltip)), callbacks: { label: ctx => ` ${ctx.dataset.label}: ${fmtBGN(ctx.parsed.y)} хил.` } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 } } },
        y: { grid: { color: '#F1F5F9' }, ticks: { font: { size: 10 }, callback: v => fmtBGN(v) } }
      }
    }
  });
}

function renderLiquidityChart(bsData) {
  const labels = bsData.map(b => b.label);
  const currentRatio = bsData.map(b => {
    if (!b.current_assets || !b.current_liabilities) return null;
    return b.current_liabilities > 0 ? b.current_assets / b.current_liabilities : null;
  });
  const quickRatio = bsData.map(b => {
    if (b.cash === null || b.recv === null || !b.current_liabilities) return null;
    return b.current_liabilities > 0 ? (b.cash + b.recv) / b.current_liabilities : null;
  });

  mkChart('chart-liquidity', {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Текущо съотношение', data: currentRatio, borderColor: CHART_COLORS.amber, backgroundColor: CHART_COLORS.amberA, tension: 0.3, pointRadius: 3, borderWidth: 2, fill: false },
        { label: 'Бързо съотношение', data: quickRatio, borderColor: CHART_COLORS.teal, backgroundColor: CHART_COLORS.tealA, tension: 0.3, pointRadius: 3, borderWidth: 2, fill: false }
      ]
    },
    options: {
      ...JSON.parse(JSON.stringify(BASE_CHART_OPTIONS)),
      plugins: {
        ...JSON.parse(JSON.stringify(BASE_CHART_OPTIONS.plugins)),
        tooltip: { ...JSON.parse(JSON.stringify(BASE_CHART_OPTIONS.plugins.tooltip)), callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y?.toFixed(2)}` } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 } } },
        y: { grid: { color: '#F1F5F9' }, ticks: { font: { size: 10 }, callback: v => v.toFixed(1) }, beginAtZero: true }
      }
    }
  });
}

function renderDuPontChart(series, bsData) {
  const labels = series.map(s => s.label);
  const netMargin = series.map(s => s.revenue ? (s.net_profit / s.revenue * 100) : null);
  const assetTurnover = series.map((s, i) => {
    const bs = bsData[i];
    if (!s.revenue || !bs?.assets) return null;
    return s.revenue / bs.assets;
  });
  const equityMult = bsData.map(b => {
    if (!b?.assets || !b?.equity || b.equity === 0) return null;
    return b.assets / b.equity;
  });
  const roe = series.map((s, i) => {
    const nm = netMargin[i];
    const at = assetTurnover[i];
    const em = equityMult[i];
    if (nm === null || at === null || em === null) return null;
    return (nm / 100) * at * em * 100;
  });

  mkChart('chart-dupont', {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Нетен марж %', data: netMargin, borderColor: CHART_COLORS.red, backgroundColor: CHART_COLORS.redA, tension: 0.3, pointRadius: 3, borderWidth: 2, fill: false, yAxisID: 'y' },
        { label: 'Оборот на активи', data: assetTurnover, borderColor: CHART_COLORS.amber, backgroundColor: CHART_COLORS.amberA, tension: 0.3, pointRadius: 3, borderWidth: 2, fill: false, yAxisID: 'y2' },
        { label: 'Ливъридж', data: equityMult, borderColor: CHART_COLORS.purple, backgroundColor: CHART_COLORS.purpleA, tension: 0.3, pointRadius: 3, borderWidth: 2, fill: false, yAxisID: 'y2' },
        { label: 'ROE %', data: roe, borderColor: CHART_COLORS.green, backgroundColor: CHART_COLORS.greenA, tension: 0.3, pointRadius: 3, borderWidth: 2, fill: false, yAxisID: 'y' }
      ]
    },
    options: {
      ...JSON.parse(JSON.stringify(BASE_CHART_OPTIONS)),
      plugins: {
        ...JSON.parse(JSON.stringify(BASE_CHART_OPTIONS.plugins)),
        tooltip: { ...JSON.parse(JSON.stringify(BASE_CHART_OPTIONS.plugins.tooltip)), callbacks: {
          label: ctx => {
            const v = ctx.parsed.y;
            if (v === null || v === undefined) return '';
            if (ctx.datasetIndex === 1 || ctx.datasetIndex === 2) return ` ${ctx.dataset.label}: ${v.toFixed(2)}x`;
            return ` ${ctx.dataset.label}: ${v.toFixed(1)}%`;
          }
        }}
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 } } },
        y: { position: 'left', grid: { color: '#F1F5F9' }, ticks: { font: { size: 10 }, callback: v => v.toFixed(0) + '%' }, title: { display: true, text: '%', font: { size: 10 } } },
        y2: { position: 'right', grid: { display: false }, ticks: { font: { size: 10 }, callback: v => v.toFixed(1) + 'x' }, title: { display: true, text: 'x', font: { size: 10 } } }
      }
    }
  });
}

function renderReceivablesChart(series, bsData) {
  const labels = series.map(s => s.label);
  const recvDays = series.map((s, i) => {
    const bs = bsData[i];
    if (s.revenue === null || bs?.recv === null || s.revenue === 0) return null;
    if (currentMode === 'quarterly') {
      return (bs.recv / s.revenue) * 90;
    } else if (currentMode === 'annual') {
      return (bs.recv / s.revenue) * 365;
    } else {
      return (bs.recv / s.revenue) * 90;
    }
  });

  mkChart('chart-receivables', {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Вземния в дни',
        data: recvDays,
        borderColor: CHART_COLORS.indigo,
        backgroundColor: CHART_COLORS.indigoA,
        tension: 0.3,
        pointRadius: 4,
        borderWidth: 2,
        fill: false
      }]
    },
    options: {
      ...JSON.parse(JSON.stringify(BASE_CHART_OPTIONS)),
      plugins: {
        ...JSON.parse(JSON.stringify(BASE_CHART_OPTIONS.plugins)),
        tooltip: { ...JSON.parse(JSON.stringify(BASE_CHART_OPTIONS.plugins.tooltip)), callbacks: { label: ctx => ` ${ctx.parsed.y?.toFixed(0)} дни` } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 } } },
        y: { grid: { color: '#F1F5F9' }, ticks: { font: { size: 10 }, callback: v => v.toFixed(0) + ' дни' }, beginAtZero: true }
      }
    }
  });
}

function renderSeasonalityChart() {
  const years = ['2022', '2023', '2024', '2025'];
  const qLabels = ['Q1', 'Q2', 'Q3', 'Q4'];
  const datasets = years.map((yr, idx) => {
    const IS = D.income_statement.items;
    const rev = getQuarterly(IS.revenue, yr);
    const colors = [CHART_COLORS.blue, CHART_COLORS.green, CHART_COLORS.amber, CHART_COLORS.navy];
    return {
      label: yr,
      data: rev,
      backgroundColor: colors[idx] + '40',
      borderColor: colors[idx],
      borderWidth: 2,
      borderRadius: 4
    };
  });

  mkChart('chart-seasonality', {
    type: 'bar',
    data: {
      labels: qLabels,
      datasets
    },
    options: {
      ...JSON.parse(JSON.stringify(BASE_CHART_OPTIONS)),
      plugins: {
        ...JSON.parse(JSON.stringify(BASE_CHART_OPTIONS.plugins)),
        tooltip: { ...JSON.parse(JSON.stringify(BASE_CHART_OPTIONS.plugins.tooltip)), callbacks: { label: ctx => ` ${ctx.dataset.label}: ${fmtBGN(ctx.parsed.y)} хил.` } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 } } },
        y: { grid: { color: '#F1F5F9' }, ticks: { font: { size: 10 }, callback: v => fmtBGN(v) }, beginAtZero: true }
      }
    }
  });
}

function renderEPSvsFCFChart(series) {
  const labels = series.map(s => s.label);
  const shares = 18000000;
  
  const epsData = currentMode === 'annual' 
    ? YEARS.map(yr => D.per_share.eps_ytd[`ytd_${yr}`]?.[3] ?? null)
    : series.map(s => s.eps);
  
  const fcfPerShare = series.map(s => s.cf_fcf !== null ? s.cf_fcf / shares : null);

  mkChart('chart-eps-fcf', {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'EPS (лв.)', data: epsData, backgroundColor: CHART_COLORS.navyA, borderColor: CHART_COLORS.navy, borderWidth: 1.5, borderRadius: 4 },
        { label: 'FCF/акция (лв.)', data: fcfPerShare, backgroundColor: CHART_COLORS.tealA, borderColor: CHART_COLORS.teal, borderWidth: 1.5, borderRadius: 4 }
      ]
    },
    options: {
      ...JSON.parse(JSON.stringify(BASE_CHART_OPTIONS)),
      plugins: {
        ...JSON.parse(JSON.stringify(BASE_CHART_OPTIONS.plugins)),
        tooltip: { ...JSON.parse(JSON.stringify(BASE_CHART_OPTIONS.plugins.tooltip)), callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y?.toFixed(2)} лв.` } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 } } },
        y: { grid: { color: '#F1F5F9' }, ticks: { font: { size: 10 }, callback: v => v.toFixed(2) + ' лв.' } }
      }
    }
  });
}

function renderIncomeTable(series) {
  const thead = document.getElementById('income-thead');
  const tbody = document.getElementById('income-tbody');

  const cols = series.map(s => s.label);
  thead.innerHTML = '<th>Показател</th>' + cols.map(c => `<th>${c}</th>`).join('');

  const rows = [
    { key: 'revenue', label: 'Приходи', bold: true },
    { key: 'gross_profit', label: 'Брутна печалба', bold: true },
    { key: 'ebit', label: 'EBIT', bold: true },
    { key: 'net_profit', label: 'Нетна печалба', bold: true, sep: true },
    { key: 'gross_margin', label: 'Брутен марж %', isMargin: true },
    { key: 'ebit_margin', label: 'EBIT марж %', isMargin: true },
    { key: 'net_margin', label: 'Нетен марж %', isMargin: true },
  ];

  tbody.innerHTML = rows.map(row => {
    const tr_class = row.sep ? 'separator' : (row.isMargin ? 'margin-row' : '');
    const cells = series.map(s => {
      let val;
      if (row.key === 'gross_margin') val = s.revenue ? s.gross_profit / s.revenue * 100 : null;
      else if (row.key === 'ebit_margin') val = s.revenue ? s.ebit / s.revenue * 100 : null;
      else if (row.key === 'net_margin') val = s.revenue ? s.net_profit / s.revenue * 100 : null;
      else val = s[row.key];
      return numCell(val, row.isMargin);
    }).join('');
    const tdLabel = row.bold ? `<td><strong>${row.label}</strong></td>` : `<td>${row.label}</td>`;
    return `<tr class="${tr_class}">${tdLabel}${cells}</tr>`;
  }).join('');
}

function renderBalanceTable(bsData) {
  const thead = document.getElementById('balance-thead');
  const tbody = document.getElementById('balance-tbody');

  thead.innerHTML = '<th>Показател</th>' + bsData.map(b => `<th>${b.label}</th>`).join('');

  const rows = [
    { key: 'assets', label: 'Общо активи', bold: true },
    { key: 'cash', label: 'Пари' },
    { key: 'recv', label: 'Търговски вземания' },
    { key: 'equity', label: 'Собствен капитал', bold: true, sep: true },
    { key: 'liabilities', label: 'Общо пасиви' },
    { key: 'de', label: 'D/E коефициент', isRatio: true },
  ];

  tbody.innerHTML = rows.map(row => {
    const tr_class = row.sep ? 'separator' : '';
    const cells = bsData.map(b => {
      let val;
      if (row.key === 'de') {
        val = b.equity && b.equity !== 0 ? b.liabilities / b.equity : null;
        if (val !== null) {
          const cls = val > 1 ? 'negative' : '';
          return `<td class="${cls}">${val.toFixed(2)}</td>`;
        }
        return '<td>–</td>';
      }
      val = b[row.key];
      return numCell(val, false);
    }).join('');
    const tdLabel = row.bold ? `<td><strong>${row.label}</strong></td>` : `<td>${row.label}</td>`;
    return `<tr class="${tr_class}">${tdLabel}${cells}</tr>`;
  }).join('');
}

function getShareCount(year, quarter) {
  const s = D.per_share.shares;
  if (year === '2025' && (quarter === 3 || quarter === 4)) return s.q3_q4_2025;
  if (year === '2025') return s.q1_q2_2025;
  return s[year] || 18000000;
}

function getShareCountAnnual(year) {
  const s = D.per_share.shares;
  if (year === '2025') return s.q3_q4_2025;
  return s[year] || 18000000;
}

function renderYoYGrowthChart(series) {
  const labels = series.map(s => s.label);
  const revGrowth = [];
  const npGrowth = [];

  if (currentMode === 'annual') {
    for (let i = 0; i < series.length; i++) {
      if (i === 0) { revGrowth.push(null); npGrowth.push(null); continue; }
      const prev = series[i - 1];
      revGrowth.push(prev.revenue && series[i].revenue ? ((series[i].revenue - prev.revenue) / Math.abs(prev.revenue) * 100) : null);
      npGrowth.push(prev.net_profit && series[i].net_profit ? ((series[i].net_profit - prev.net_profit) / Math.abs(prev.net_profit) * 100) : null);
    }
  } else if (currentMode === 'quarterly') {
    const IS = D.income_statement.items;
    for (const s of series) {
      const m = s.label.match(/Q(\d)'(\d\d)/);
      if (!m) { revGrowth.push(null); npGrowth.push(null); continue; }
      const qi = parseInt(m[1]) - 1;
      const yr = '20' + m[2];
      const prevYr = String(parseInt(yr) - 1);
      const prevRevQ = getQuarterly(IS.revenue, prevYr);
      const prevNpQ = getQuarterly(IS.net_profit, prevYr);
      const pr = prevRevQ[qi]; const pn = prevNpQ[qi];
      revGrowth.push(pr && s.revenue ? ((s.revenue - pr) / Math.abs(pr) * 100) : null);
      npGrowth.push(pn && s.net_profit ? ((s.net_profit - pn) / Math.abs(pn) * 100) : null);
    }
  } else {
    for (let i = 0; i < series.length; i++) {
      if (i < 4) { revGrowth.push(null); npGrowth.push(null); continue; }
      const prev = series[i - 4];
      revGrowth.push(prev.revenue && series[i].revenue ? ((series[i].revenue - prev.revenue) / Math.abs(prev.revenue) * 100) : null);
      npGrowth.push(prev.net_profit && series[i].net_profit ? ((series[i].net_profit - prev.net_profit) / Math.abs(prev.net_profit) * 100) : null);
    }
  }

  mkChart('chart-yoy-growth', {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Приходи г/г %', data: revGrowth, borderColor: CHART_COLORS.blue, backgroundColor: CHART_COLORS.blueA, tension: 0.3, pointRadius: 3, borderWidth: 2, fill: false },
        { label: 'Нетна печалба г/г %', data: npGrowth, borderColor: CHART_COLORS.green, backgroundColor: CHART_COLORS.greenA, tension: 0.3, pointRadius: 3, borderWidth: 2, fill: false }
      ]
    },
    options: {
      ...JSON.parse(JSON.stringify(BASE_CHART_OPTIONS)),
      plugins: {
        ...JSON.parse(JSON.stringify(BASE_CHART_OPTIONS.plugins)),
        tooltip: { ...JSON.parse(JSON.stringify(BASE_CHART_OPTIONS.plugins.tooltip)), callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y?.toFixed(1)}%` } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 } } },
        y: { grid: { color: '#F1F5F9' }, ticks: { font: { size: 10 }, callback: v => v.toFixed(0) + '%' } }
      }
    }
  });
}

function renderDividendsChart() {
  const divItem = D.cash_flows.items.financing.dividends_paid;
  const years = ['2022', '2023', '2024', '2025'];
  const divAbs = years.map(yr => {
    const ytd = divItem[`ytd_${yr}`] || divItem[`ytd_${yr}_original`];
    return ytd ? Math.abs(ytd[3]) : 0;
  });

  mkChart('chart-dividends', {
    type: 'bar',
    data: {
      labels: years,
      datasets: [{
        label: 'Дивиденти (хил. BGN)',
        data: divAbs,
        backgroundColor: CHART_COLORS.greenA,
        borderColor: CHART_COLORS.green,
        borderWidth: 1.5,
        borderRadius: 4
      }]
    },
    options: {
      ...JSON.parse(JSON.stringify(BASE_CHART_OPTIONS)),
      plugins: {
        ...JSON.parse(JSON.stringify(BASE_CHART_OPTIONS.plugins)),
        tooltip: { ...JSON.parse(JSON.stringify(BASE_CHART_OPTIONS.plugins.tooltip)), callbacks: { label: ctx => ` ${fmtBGN(ctx.parsed.y)} хил.` } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 } } },
        y: { grid: { color: '#F1F5F9' }, ticks: { font: { size: 10 }, callback: v => fmtBGN(v) }, beginAtZero: true }
      }
    }
  });
}

function renderDividendPerShareChart() {
  const divItem = D.cash_flows.items.financing.dividends_paid;
  const years = ['2022', '2023', '2024', '2025'];
  const dps = years.map(yr => {
    const ytd = divItem[`ytd_${yr}`] || divItem[`ytd_${yr}_original`];
    const div = ytd ? Math.abs(ytd[3]) : 0;
    const shares = getShareCountAnnual(yr);
    return div > 0 ? (div * 1000) / shares : 0;
  });

  mkChart('chart-dps', {
    type: 'bar',
    data: {
      labels: years,
      datasets: [{
        label: 'Дивидент/акция (лв.)',
        data: dps,
        backgroundColor: CHART_COLORS.navyA,
        borderColor: CHART_COLORS.navy,
        borderWidth: 1.5,
        borderRadius: 4
      }]
    },
    options: {
      ...JSON.parse(JSON.stringify(BASE_CHART_OPTIONS)),
      plugins: {
        ...JSON.parse(JSON.stringify(BASE_CHART_OPTIONS.plugins)),
        tooltip: { ...JSON.parse(JSON.stringify(BASE_CHART_OPTIONS.plugins.tooltip)), callbacks: { label: ctx => ` ${ctx.parsed.y?.toFixed(2)} лв./акция` } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 } } },
        y: { grid: { color: '#F1F5F9' }, ticks: { font: { size: 10 }, callback: v => v.toFixed(2) + ' лв.' }, beginAtZero: true }
      }
    }
  });
}

function renderPayoutRatioChart() {
  const divItem = D.cash_flows.items.financing.dividends_paid;
  const IS = D.income_statement.items;
  const years = ['2022', '2023', '2024', '2025'];
  const payout = years.map(yr => {
    const ytd = divItem[`ytd_${yr}`] || divItem[`ytd_${yr}_original`];
    const div = ytd ? Math.abs(ytd[3]) : 0;
    const np = getYTD(IS.net_profit, yr)[3];
    return (div > 0 && np > 0) ? (div / np * 100) : null;
  });

  mkChart('chart-payout', {
    type: 'line',
    data: {
      labels: years,
      datasets: [{
        label: 'Коефициент на изплащане %',
        data: payout,
        borderColor: CHART_COLORS.amber,
        backgroundColor: CHART_COLORS.amberA,
        tension: 0.3,
        pointRadius: 4,
        borderWidth: 2,
        fill: false
      }]
    },
    options: {
      ...JSON.parse(JSON.stringify(BASE_CHART_OPTIONS)),
      plugins: {
        ...JSON.parse(JSON.stringify(BASE_CHART_OPTIONS.plugins)),
        tooltip: { ...JSON.parse(JSON.stringify(BASE_CHART_OPTIONS.plugins.tooltip)), callbacks: { label: ctx => ` ${ctx.parsed.y?.toFixed(1)}%` } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 } } },
        y: { grid: { color: '#F1F5F9' }, ticks: { font: { size: 10 }, callback: v => v.toFixed(0) + '%' }, beginAtZero: true }
      }
    }
  });
}

function renderWorkingCapitalChart(series, bsData) {
  const labels = series.map(s => s.label);
  const daysFactor = (currentMode === 'quarterly') ? 90 : (currentMode === 'ltm' ? 365 : 365);

  const invDays = series.map((s, i) => {
    const bs = bsData[i];
    if (!bs?.inventories || !s.cogs || s.cogs === 0) return null;
    return (bs.inventories / s.cogs) * daysFactor;
  });
  const recvDays = series.map((s, i) => {
    const bs = bsData[i];
    if (!bs?.recv || !s.revenue || s.revenue === 0) return null;
    return (bs.recv / s.revenue) * daysFactor;
  });
  const payDays = series.map((s, i) => {
    const bs = bsData[i];
    if (!bs?.trade_payables || !s.cogs || s.cogs === 0) return null;
    return (bs.trade_payables / s.cogs) * daysFactor;
  });
  const ccc = series.map((s, i) => {
    if (invDays[i] === null || recvDays[i] === null || payDays[i] === null) return null;
    return invDays[i] + recvDays[i] - payDays[i];
  });

  mkChart('chart-working-capital', {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Дни запаси', data: invDays, borderColor: CHART_COLORS.amber, backgroundColor: CHART_COLORS.amberA, tension: 0.3, pointRadius: 3, borderWidth: 2, fill: false },
        { label: 'Дни вземания', data: recvDays, borderColor: CHART_COLORS.blue, backgroundColor: CHART_COLORS.blueA, tension: 0.3, pointRadius: 3, borderWidth: 2, fill: false },
        { label: 'Дни задължения', data: payDays, borderColor: CHART_COLORS.red, backgroundColor: CHART_COLORS.redA, tension: 0.3, pointRadius: 3, borderWidth: 2, fill: false },
        { label: 'CCC (дни)', data: ccc, borderColor: CHART_COLORS.navy, backgroundColor: CHART_COLORS.navyA, tension: 0.3, pointRadius: 4, borderWidth: 2.5, fill: false, borderDash: [5, 3] }
      ]
    },
    options: {
      ...JSON.parse(JSON.stringify(BASE_CHART_OPTIONS)),
      plugins: {
        ...JSON.parse(JSON.stringify(BASE_CHART_OPTIONS.plugins)),
        tooltip: { ...JSON.parse(JSON.stringify(BASE_CHART_OPTIONS.plugins.tooltip)), callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y?.toFixed(0)} дни` } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 } } },
        y: { grid: { color: '#F1F5F9' }, ticks: { font: { size: 10 }, callback: v => v.toFixed(0) + ' дни' } }
      }
    }
  });
}

function renderNetDebtChart(bsData) {
  const labels = bsData.map(b => b.label);
  const netDebt = bsData.map(b => {
    const totalDebt = (b.bank_loans || 0) + (b.lease_st || 0) + (b.lease_lt || 0);
    return totalDebt - (b.cash || 0);
  });
  const deRatio = bsData.map(b => {
    if (!b.equity || b.equity === 0) return null;
    return b.liabilities / b.equity;
  });

  mkChart('chart-net-debt', {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Нетен дълг (хил. BGN)',
          data: netDebt,
          backgroundColor: netDebt.map(v => v >= 0 ? CHART_COLORS.redA : CHART_COLORS.greenA),
          borderColor: netDebt.map(v => v >= 0 ? CHART_COLORS.red : CHART_COLORS.green),
          borderWidth: 1.5, borderRadius: 4, yAxisID: 'y', order: 2
        },
        {
          label: 'D/E',
          data: deRatio,
          type: 'line',
          borderColor: CHART_COLORS.navy,
          backgroundColor: CHART_COLORS.navyA,
          tension: 0.3, pointRadius: 3, borderWidth: 2, fill: false, yAxisID: 'y2', order: 1
        }
      ]
    },
    options: {
      ...JSON.parse(JSON.stringify(BASE_CHART_OPTIONS)),
      plugins: {
        ...JSON.parse(JSON.stringify(BASE_CHART_OPTIONS.plugins)),
        tooltip: { ...JSON.parse(JSON.stringify(BASE_CHART_OPTIONS.plugins.tooltip)), callbacks: {
          label: ctx => {
            if (ctx.datasetIndex === 0) return ` Нетен дълг: ${fmtBGN(ctx.parsed.y)} хил.`;
            return ` D/E: ${ctx.parsed.y?.toFixed(2)}`;
          }
        }}
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 } } },
        y: { position: 'left', grid: { color: '#F1F5F9' }, ticks: { font: { size: 10 }, callback: v => fmtBGN(v) }, title: { display: true, text: 'хил. BGN', font: { size: 10 } } },
        y2: { position: 'right', grid: { display: false }, ticks: { font: { size: 10 }, callback: v => v.toFixed(2) }, title: { display: true, text: 'D/E', font: { size: 10 } }, beginAtZero: true }
      }
    }
  });
}

function renderBVPSChart() {
  const bvps = D.per_share.book_value_per_share;
  const labels = [];
  const values = [];

  const bs21 = D.balance_sheet_2021;
  const bs22 = D.balance_sheet_2022;
  const bs23 = D.balance_sheet_2023;

  if (currentMode === 'annual' || currentMode === 'ltm') {
    // 2021: compute from equity / shares (index 4 = Dec 2021)
    if (bs21) {
      const eq21 = bs21.equity.total.values[4];
      labels.push('2021');
      values.push(eq21 ? (eq21 * 1000) / getShareCountAnnual('2021') : null);
    }
    // 2022: index 4 = Dec 2022
    if (bs22) {
      const eq22 = bs22.equity.total.values[4];
      labels.push('2022');
      values.push(eq22 ? (eq22 * 1000) / getShareCountAnnual('2022') : null);
    }
    // 2023: index 4 = Dec 2023
    if (bs23) {
      const eq23 = bs23.equity.total.values[4];
      labels.push('2023');
      values.push(eq23 ? (eq23 * 1000) / getShareCountAnnual('2023') : null);
    }
    // 2024: use original year-end value (index 4)
    if (bvps.values_2024_original) {
      labels.push('2024');
      values.push(bvps.values_2024_original[4]);
    }
    // 2025: year-end value (index 4)
    if (bvps.values) {
      labels.push('2025');
      values.push(bvps.values[4]);
    }
  } else {
    // Quarterly / LTM: show all quarters
    for (let i = 1; i <= 4; i++) {
      labels.push(`Q${i}'22`);
      const eq = bs22.equity.total.values[i];
      values.push(eq ? (eq * 1000) / getShareCount('2022', i) : null);
    }
    for (let i = 1; i <= 4; i++) {
      labels.push(`Q${i}'23`);
      const eq = bs23.equity.total.values[i];
      values.push(eq ? (eq * 1000) / getShareCount('2023', i) : null);
    }
    // 2024 from values_2024_original
    if (bvps.values_2024_original) {
      for (let i = 1; i <= 4; i++) {
        labels.push(`Q${i}'24`);
        values.push(bvps.values_2024_original[i]);
      }
    }
    // 2025 from values
    if (bvps.values) {
      for (let i = 1; i <= 4; i++) {
        labels.push(`Q${i}'25`);
        values.push(bvps.values[i]);
      }
    }
  }

  mkChart('chart-bvps', {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'BVPS (лв.)',
        data: values,
        borderColor: CHART_COLORS.navy,
        backgroundColor: CHART_COLORS.navyA,
        tension: 0.3,
        pointRadius: 4,
        borderWidth: 2,
        fill: true
      }]
    },
    options: {
      ...JSON.parse(JSON.stringify(BASE_CHART_OPTIONS)),
      plugins: {
        ...JSON.parse(JSON.stringify(BASE_CHART_OPTIONS.plugins)),
        tooltip: { ...JSON.parse(JSON.stringify(BASE_CHART_OPTIONS.plugins.tooltip)), callbacks: { label: ctx => ` BVPS: ${ctx.parsed.y?.toFixed(2)} лв.` } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 } } },
        y: { grid: { color: '#F1F5F9' }, ticks: { font: { size: 10 }, callback: v => v.toFixed(1) + ' лв.' } }
      }
    }
  });
}

function renderCashFlowTable(series) {
  const thead = document.getElementById('cf-thead');
  const tbody = document.getElementById('cf-tbody');
  if (!thead || !tbody) return;

  const CF = D.cash_flows.items;
  let tableData;

  if (currentMode === 'annual') {
    tableData = YEARS.map(yr => ({
      label: yr,
      cfOp: CF.operating.total[`ytd_${yr}`]?.[3] ?? null,
      cfInv: CF.investing.total[`ytd_${yr}`]?.[3] ?? null,
      cfFin: CF.financing.total[`ytd_${yr}`]?.[3] ?? null,
      cfNet: CF.summary.net_change[`ytd_${yr}`]?.[3] ?? null,
      capex: CF.investing.capex[`ytd_${yr}`]?.[3] ?? null,
    }));
  } else if (currentMode === 'quarterly') {
    tableData = [];
    for (const yr of YEARS) {
      if (!activeYears.has(yr)) continue;
      const opQ = CF.operating.total[`quarterly_${yr}`] || [null,null,null,null];
      const invQ = CF.investing.total[`quarterly_${yr}`] || [null,null,null,null];
      const finQ = CF.financing.total[`quarterly_${yr}`] || [null,null,null,null];
      const netQ = CF.summary.net_change[`quarterly_${yr}`] || [null,null,null,null];
      const capYTD = CF.investing.capex[`ytd_${yr}`] || [null,null,null,null];
      const capQ = [
        capYTD[0],
        capYTD[1] !== null && capYTD[0] !== null ? capYTD[1] - capYTD[0] : null,
        capYTD[2] !== null && capYTD[1] !== null ? capYTD[2] - capYTD[1] : null,
        capYTD[3] !== null && capYTD[2] !== null ? capYTD[3] - capYTD[2] : null,
      ];
      for (let i = 0; i < 4; i++) {
        tableData.push({
          label: `Q${i+1}'${yr.slice(2)}`,
          cfOp: opQ[i], cfInv: invQ[i], cfFin: finQ[i], cfNet: netQ[i], capex: capQ[i]
        });
      }
    }
  } else {
    tableData = series.map(s => ({
      label: s.label, cfOp: s.cf_op, cfInv: null, cfFin: null, cfNet: s.cf_net,
      capex: null, fcfOverride: s.cf_fcf
    }));
  }

  const cols = tableData.map(d => d.label);
  thead.innerHTML = '<th>Показател</th>' + cols.map(c => `<th>${c}</th>`).join('');

  const rows = [
    { key: 'cfOp', label: 'Оперативен CF', bold: true },
    { key: 'cfInv', label: 'Инвестиционен CF' },
    { key: 'cfFin', label: 'Финансов CF' },
    { key: 'cfNet', label: 'Нетна промяна', bold: true, sep: true },
    { key: 'fcf', label: 'FCF (Опер. + CAPEX)', bold: true },
  ];

  tbody.innerHTML = rows.map(row => {
    const tr_class = row.sep ? 'separator' : '';
    const cells = tableData.map(d => {
      let val;
      if (row.key === 'fcf') val = d.fcfOverride !== undefined ? d.fcfOverride : (d.cfOp !== null && d.capex !== null ? d.cfOp + d.capex : null);
      else val = d[row.key];
      return numCell(val, false);
    }).join('');
    const tdLabel = row.bold ? `<td><strong>${row.label}</strong></td>` : `<td>${row.label}</td>`;
    return `<tr class="${tr_class}">${tdLabel}${cells}</tr>`;
  }).join('');
}

function renderStockInfo() {
  const el = document.getElementById('stock-info');
  if (!el) return;
  const sh = D.shareholders;
  const sub = D.subsidiaries;
  const totalShares = sh?.total_shares || 18157559;

  let holdersHtml = '';
  if (sh?.holders) {
    holdersHtml = sh.holders.map(h =>
      `<div class="holder-item"><span class="holder-name">${h.name}</span><span class="holder-pct">${h.pct.toFixed(2)}%</span><span class="holder-shares">${fmtNum(h.shares)} акции</span></div>`
    ).join('');
  }

  const domesticCount = sub?.domestic?.length || 0;
  const foreignCount = sub?.foreign?.length || 0;

  el.innerHTML = `
    <div class="info-block">
      <div class="info-block-title">Акционери</div>
      <div class="info-block-subtitle">Към ${sh?.as_of || 'N/A'}</div>
      <div class="holders-list">${holdersHtml}</div>
    </div>
    <div class="info-block">
      <div class="info-block-title">Корпоративна информация</div>
      <div class="info-items">
        <div class="info-row"><span class="info-label">Общо акции</span><span class="info-value">${fmtNum(totalShares)}</span></div>
        <div class="info-row"><span class="info-label">ISIN</span><span class="info-value">BG1100003166</span></div>
        <div class="info-row"><span class="info-label">Сектор</span><span class="info-value">IoT / Smart Home</span></div>
        <div class="info-row"><span class="info-label">ЕИК</span><span class="info-value">${D.meta?.eik || '175440738'}</span></div>
        <div class="info-row"><span class="info-label">Дъщерни дружества</span><span class="info-value">${domesticCount + foreignCount} (${domesticCount} BG + ${foreignCount} чужбина)</span></div>
      </div>
    </div>
  `;
}

function exportCSV() {
  const series = buildSeriesData();
  const bsData = buildBalanceData();
  const rows = [];

  // Header
  const headers = ['Показател', ...series.map(s => s.label)];
  rows.push(headers);

  // Income statement
  rows.push(['--- Отчет за доходите ---']);
  rows.push(['Приходи', ...series.map(s => s.revenue)]);
  rows.push(['Брутна печалба', ...series.map(s => s.gross_profit)]);
  rows.push(['EBIT', ...series.map(s => s.ebit)]);
  rows.push(['Нетна печалба', ...series.map(s => s.net_profit)]);
  rows.push(['Брутен марж %', ...series.map(s => s.revenue ? (s.gross_profit / s.revenue * 100).toFixed(1) : '')]);
  rows.push(['EBIT марж %', ...series.map(s => s.revenue ? (s.ebit / s.revenue * 100).toFixed(1) : '')]);
  rows.push(['Нетен марж %', ...series.map(s => s.revenue ? (s.net_profit / s.revenue * 100).toFixed(1) : '')]);

  // Cash flows
  rows.push(['--- Парични потоци ---']);
  rows.push(['Оперативен CF', ...series.map(s => s.cf_op)]);
  rows.push(['FCF', ...series.map(s => s.cf_fcf)]);
  rows.push(['Нетна промяна', ...series.map(s => s.cf_net)]);
  rows.push(['EPS', ...series.map(s => s.eps)]);

  // Balance sheet
  rows.push(['--- Баланс ---']);
  const bsHeaders = ['Показател', ...bsData.map(b => b.label)];
  rows.push(bsHeaders);
  rows.push(['Общо активи', ...bsData.map(b => b.assets)]);
  rows.push(['Собствен капитал', ...bsData.map(b => b.equity)]);
  rows.push(['Общо пасиви', ...bsData.map(b => b.liabilities)]);
  rows.push(['Пари', ...bsData.map(b => b.cash)]);
  rows.push(['Вземания', ...bsData.map(b => b.recv)]);

  const csvContent = rows.map(r => r.map(v => {
    if (v === null || v === undefined) return '';
    const str = String(v);
    return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
  }).join(',')).join('\n');

  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `shelly_group_${currentMode}_${new Date().toISOString().slice(0,10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

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
  renderWorkingCapitalChart(series, bsData);
  renderSeasonalityChart();

  renderEPSvsFCFChart(series);
  renderBVPSChart();

  renderDividendsChart();
  renderDividendPerShareChart();
  renderPayoutRatioChart();

  renderIncomeTable(series);
  renderBalanceTable(bsData);
  renderCashFlowTable(series);

  renderStockInfo();

  document.getElementById('year-filters').style.display =
    currentMode === 'quarterly' ? 'flex' : 'none';
}

function setMode(mode) {
  currentMode = mode;
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
  refresh();
}

function updateYearFilter() {
  activeYears = new Set();
  document.querySelectorAll('#year-filters input[type=checkbox]:checked').forEach(cb => {
    activeYears.add(cb.value);
  });
  refresh();
}

function deepMerge(target, source) {
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (!target[key]) target[key] = {};
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

async function init() {
  try {
    const years = ['2022', '2023', '2024', '2025'];
    const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];

    const filePromises = [];
    for (const year of years) {
      for (const q of quarters) {
        filePromises.push(fetch(`./data/shelly_group_${year}_${q}.json`));
      }
    }

    const responses = await Promise.all(filePromises);
    const failedFiles = responses.filter(r => !r.ok);
    if (failedFiles.length > 0) {
      throw new Error(`Failed to load ${failedFiles.length} quarterly files`);
    }

    const jsonPromises = responses.map(r => r.json());
    const allData = await Promise.all(jsonPromises);

    // Load 2021 Q4 file separately (only Q4 exists)
    try {
      const resp2021 = await fetch('./data/shelly_group_2021_Q4.json');
      if (resp2021.ok) allData.push(await resp2021.json());
    } catch (e) {
      console.warn('2021 Q4 data not available:', e);
    }
    
    D = {};
    for (const data of allData) {
      deepMerge(D, data);
    }

    document.getElementById('loading').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';
    refresh();
  } catch (e) {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('error-banner').style.display = 'block';
    console.error('Failed to load quarterly data:', e);
  }
}

document.addEventListener('DOMContentLoaded', init);
