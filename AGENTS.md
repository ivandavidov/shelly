# AGENTS.md — Шелли Груп АД Финансов Дашборд

Пълна документация за структурата, данните и логиката на проекта. Предназначена за AI агенти и разработчици, които поддържат или разширяват дашборда.

---

## Съдържание

1. [Обзор на проекта](#1-обзор-на-проекта)
2. [Структура на файловете](#2-структура-на-файловете)
3. [Поток на данните](#3-поток-на-данните)
4. [JSON схема](#4-json-схема)
5. [Архитектура на дашборда](#5-архитектура-на-дашборда)
6. [Графики и таблици](#6-графики-и-таблици)
7. [Важни особености и аномалии](#7-важни-особености-и-аномалии)
8. [Как се добавя ново тримесечие](#8-как-се-добавя-ново-тримесечие)
9. [Как се добавя нова графика](#9-как-се-добавя-нова-графика)
10. [Работна среда и стартиране](#10-работна-среда-и-стартиране)

---

## 1. Обзор на проекта

Инвеститорски финансов дашборд за **Шелли Груп АД** (BSE: SLYG, XETRA: SLYG) — Bulgarian IoT / Smart Home компания. Покрива 2021–2025 (FY 2021 + Q1 2022 → Q4 2025).

**Данни:** Консолидирани финансови отчети по МСФО (IFRS). Историческите JSON данни до края на 2025 са в **хиляди BGN**, но дашбордът ги визуализира в **хиляди EUR** чрез конверсия по фиксиран курс `1.95583`. Данните от 2026 нататък следва да се въвеждат директно в **EUR**.

**Технологии:**
- Vanilla JS + Chart.js 4.4.4 — фронтенд дашборд
- Без build step, без framework — просто static files

**Еволюция на наименованието на компанията:**
| Период | Юридическо наименование |
|--------|------------------------|
| 2021–2022 | ALLTERCO JSCo |
| Q1 2023 | Allterco AD |
| Q2–Q4 2023 | Шелли Груп АД |
| 2024–2025 | Шелли Груп ЕД (EAD) |

---

## 2. Структура на файловете

```
/Users/mac/projects/shelly/
├── README.md                        ← насочва към AGENTS.md
├── AGENTS.md                        ← този файл
└── docs/                            ← web root (статичен сайт)
    ├── index.html                   ← HTML структура
    ├── app.js                       ← цялата логика на дашборда
    ├── styles.css                   ← CSS стилове
    └── data/                        ← JSON файлове, по един на тримесечие/година
        ├── shelly_group_2021_Q4.json  ← FY 2021 (само годишни данни)
        ├── shelly_group_2022_Q1.json
        ├── shelly_group_2022_Q2.json
        ├── ...
        └── shelly_group_2025_Q4.json
```

---

## 3. Поток на данните

```
PDF отчет (четен ръчно)
       ↓  извличане на данни
JSON файл (docs/data/shelly_group_YYYY_QN.json)  ← директно създаден/редактиран
       ↓  fetch() + deepMerge()  (app.js init())
Глобален обект D (in-memory)
       ↓  buildSeriesData() / buildBalanceData()
Chart.js + HTML таблици
```

### Създаване и актуализиране на JSON файлове

JSON файловете се създават и редактират **директно** — без Python скрипт или друго средство за генериране. Данните се въвеждат ръчно от PDF отчетите.

---

## 4. JSON схема

### Топ-ниво ключове (след deepMerge)

```json
{
  "meta": { ... },
  "shareholders": { ... },
  "subsidiaries": { ... },
  "income_statement": { "ytd": {...}, "quarterly_labels": {...}, "items": {...} },
  "cash_flows": { "ytd": {...}, "items": {...} },
  "per_share": { "shares": {...}, "eps_ytd": {...}, "eps_quarterly": {...}, "book_value_per_share": {...} },
  "ratios": { ... },
  "balance_sheet": { ... },              ← 2025 (restated comparative 2024)
  "balance_sheet_2024_original": { ... },
  "balance_sheet_2023": { ... },
  "balance_sheet_2022": { ... },
  "balance_sheet_2021": { ... }          ← само Dec 2020 и Dec 2021 (индекси 0 и 4)
}
```

### Масиви с данни — конвенция за индекси

Всички масиви с периодни данни са с **4 елемента** [Q1, Q2, Q3, Q4]:

```js
item.ytd_2025       = [Q1_YTD, H1_YTD, 9M_YTD, FY_YTD]       // кумулативни от 1 януари
item.quarterly_2025 = [Q1_standalone, Q2_standalone, Q3_standalone, Q4_standalone]
```

За **2021** са налични само годишни (FY) данни — индекс 3:
```js
item.ytd_2021 = [null, null, null, FY_value]
// quarterly_2021 не се включва (липсват тримесечни данни)
```

Изключение — **Balance Sheet** `values` масиви имат **5 елемента**:
```js
bs.assets.total.values = [PrevYearEnd, Q1_end, Q2_end, Q3_end, Q4_end]
//                          index 0       1       2       3       4
```
В `buildBalanceData()`: annual режим → индекс `4`, quarterly режим → индекси `1..4`.

За `balance_sheet_2021`: индекс `0` = 31 дек 2020, индекс `4` = 31 дек 2021, индекси `1..3` = `null`.

### Структура на Income Statement item

```json
"revenue": {
  "label_bg": "Приходи от продажби",
  "label_en": "Revenue",
  "note": "4.01",
  "ytd_2025": [51759, 105550, 170036, 292869],
  "ytd_2024": [40164, 81656, 127038, 208704],
  "ytd_2024_original": [40164, 81656, 127038, 208704],
  "ytd_2023": [27608, 54785, 86324, 146542],
  "ytd_2022": [17150, 35753, 57829, 93234],
  "ytd_2021": [null, null, null, 59503],
  "quarterly_2025": [51759, 53791, 64486, 122833],
  "quarterly_2024": [40164, 41492, 45382, 81666],
  "quarterly_2023": [27608, 27177, 31539, 60218],
  "quarterly_2022": [17150, 18603, 22076, 35405]
}
```

### Структура на Balance Sheet

```json
"balance_sheet": {
  "dates": ["2024-12-31", "2025-03-31", "2025-06-30", "2025-09-30", "2025-12-31"],
  "assets": {
    "current": {
      "inventories":        { "values": [v0, v1, v2, v3, v4] },
      "trade_receivables":  { "values": [...] },
      "other_receivables":  { "values": [...] },
      "cash":               { "values": [...] },
      "total":              { "values": [...] }
    },
    "non_current": {
      "ppe":          { "values": [...] },
      "intangibles":  { "values": [...] },
      "right_of_use": { "values": [...] },
      "goodwill":     { "values": [...] },
      "associates":   { "values": [...] },
      "deferred_tax": { "values": [...] },
      "total":        { "values": [...] }
    },
    "total": { "values": [...] }
  },
  "liabilities": {
    "current": {
      "bank_loans_st":  { "values": [...] },
      "lease_st":       { "values": [...] },
      "trade_payables": { "values": [...] },
      "employee_st":    { "values": [...] },
      "other":          { "values": [...] },
      "total":          { "values": [...] }
    },
    "non_current": {
      "bank_loans_lt": { "values": [...] },
      "lease_lt":      { "values": [...] },
      "total":         { "values": [...] }
    },
    "total": { "values": [...] }
  },
  "equity": {
    "share_capital":    { "values": [...] },
    "retained_earnings":{ "values": [...] },
    "premium_reserve":  { "values": [...] },
    "legal_reserves":   { "values": [...] },
    "fx_translation":   { "values": [...] },
    "equity_to_parent": { "values": [...] },
    "nci":              { "values": [...] },
    "total":            { "values": [...] }
  }
}
```

### `extractBSPoint(bs, i)` — достъпвани ключове

Функцията търси `lc.bank_loans || lc.bank_loans_st` за краткосрочни банкови заеми. Ако нито един не съществува, приема 0. Аналогично за `lnc.bank_loans_lt`.

### Брой акции

```js
D.per_share.shares = {
  "2021":       18000000,
  "2022":       18000000,
  "2023":       18000000,
  "2024":       18105559,
  "q1_q2_2025": 18105559,
  "q3_q4_2025": 18157559
}
```

Функции в app.js:
- `getShareCount(year, quarter)` — за quarterly/LTM режим (quarter = 1..4)
- `getShareCountAnnual(year)` — за annual режим

### Дивиденти

```js
D.cash_flows.items.financing.dividends_paid = {
  ytd_2025: [0, 0, -4603, -4603],
  ytd_2024: [0, -4379, -4590, -4590],
  ytd_2023: [0, 0, -4500, -4500],
  ytd_2022: [0, 0, -1719, -1719],
  ytd_2021: [null, null, null, -3436]
}
```
Стойностите са **отрицателни** (изходящи плащания). Използвай `Math.abs()`.

### BVPS (Book Value Per Share)

```js
D.per_share.book_value_per_share = {
  dates:  ["2024-12-31", "2025-03-31", ...],
  values: [8.24, 8.87, 9.13, 10.01, 11.47],
  dates_2024_original:  ["2023-12-31", ...],
  values_2024_original: [6.09, 6.51, 6.77, 7.28, 8.26]
}
```
За 2021–2023, BVPS се изчислява в app.js от `equity.equity_to_parent / shares`.

---

## 5. Архитектура на дашборда

### Глобално състояние

```js
let D = null;              // обединен обект с всички данни (след deepMerge)
let currentMode = 'quarterly';  // 'quarterly' | 'annual' | 'ltm'
let activeYears = new Set(['2021','2022','2023','2024','2025']);
const YEARS = ['2021','2022','2023','2024','2025'];
const charts = {};         // { canvasId: Chart instance }
```

### Инициализация (init())

1. Зарежда JSON файловете паралелно с `Promise.all()`:
   - `shelly_group_{year}_{Q}.json` за years `['2022','2023','2024','2025']` × quarters `['Q1','Q2','Q3','Q4']`
   - `shelly_group_2021_Q4.json` — зарежда се отделно (само Q4 съществува)
2. Обединява ги с `deepMerge(target, source)` — рекурсивен merge, масивите се заместват (не конкатенират)
3. Скрива spinner, показва `#dashboard`
4. Извиква `refresh()`

### Основни функции за данни

| Функция | Описание |
|---------|----------|
| `getQuarterly(item, year)` | Връща `item.quarterly_YYYY` (за 2024 → `quarterly_2024`) |
| `getYTD(item, year)` | Връща `item.ytd_YYYY` (за 2024 → `ytd_2024`) |
| `buildSeriesData()` | Строи масив от обекти за текущия mode (quarterly/annual/LTM) |
| `buildBalanceData()` | Строи масив от BS snapshot обекти |
| `extractBSPoint(bs, i)` | Helper — извлича всички BS полета от `bs` на индекс `i` |
| `getShareCount(year, q)` | Правилният брой акции за quarterly/LTM |
| `getShareCountAnnual(year)` | Правилният брой акции за annual |

### buildSeriesData() — изходен обект

Всеки елемент:
```js
{
  label,          // напр. "Q1'25" / "2025" / "LTM Q4'25"
  revenue, net_profit, gross_profit, ebit,
  cogs, sellExp, adminExp, otherExp,
  finInc, finExp, tax,
  cf_op, cf_fcf, cf_net,
  eps
}
```

### buildBalanceData() — изходен обект

Всеки елемент:
```js
{
  label,
  assets, liabilities, equity,
  current_assets, current_liabilities,
  bank_loans, bank_loans_st,
  lease_st, lease_lt,
  trade_payables,
  cash, recv,    // recv = trade_receivables
  inventories,
  re             // retained_earnings
}
```

### LTM режим

- Строи `allQuarters` масив от наличните тримесечия
- Слайдинг прозорец от 4 квартала (i-3 .. i)
- Сумира income/CF стойности; Balance sheet → snapshot стойности (не суми)
- LTM EPS = сума от 4 тримесечни EPS

### refresh()

Главната функция, извиквана при промяна на mode или year filter. Извиква всички `render*` функции.

### mkChart(id, config)

```js
function mkChart(id, config) {
  const ctx = document.getElementById(id).getContext('2d');
  if (charts[id]) charts[id].destroy();
  charts[id] = new Chart(ctx, config);
  return charts[id];
}
```

### BASE_CHART_OPTIONS

Задължително се **deep clone** преди употреба:
```js
options: {
  ...JSON.parse(JSON.stringify(BASE_CHART_OPTIONS)),
  // custom overrides
}
```

---

## 6. Графики и таблици

| Canvas ID | Функция | Описание |
|-----------|---------|----------|
| `chart-revenue` | `renderRevenueChart` | Bars: Приходи + Нетна печалба |
| `chart-margins` | `renderMarginsChart` | Lines: Брутен/EBIT/Нетен марж % |
| `chart-yoy-growth` | `renderYoYGrowthChart` | Lines: Растеж г/г % |
| `chart-expense-breakdown` | `renderExpenseBreakdownChart` | Stacked bars: разходна структура |
| `chart-cashflow` | `renderCashflowChart` | Bars: OCF / FCF / Нетна промяна |
| `chart-fcf` | `renderFCFChart` | Bars: FCF (зелено/червено) |
| `chart-interest-coverage` | `renderInterestCoverageChart` | Bars: EBIT / Fin.Exp (x) |
| `chart-earnings-quality` | `renderEarningsQualityChart` | Line: OCF / Net Profit |
| `chart-balance` | `renderBalanceChart` | Stacked bars: Капитал + Пасиви |
| `chart-asset-growth` | `renderAssetGrowthChart` | Lines: Активи / Капитал / Пари |
| `chart-net-debt` | `renderNetDebtChart` | Bar+Line: Нетен дълг + D/E |
| `chart-liquidity` | `renderLiquidityChart` | Lines: Current / Quick ratio |
| `chart-dupont` | `renderDuPontChart` | Lines: ROE decomposition |
| `chart-receivables` | `renderReceivablesChart` | Line: Дни вземания |
| `chart-seasonality` | `renderSeasonalityChart` | Grouped bars: Q1-Q4 по години |
| `chart-working-capital` | `renderWorkingCapitalChart` | Lines: Inventory/Recv/Pay days + CCC |
| `chart-dividends` | `renderDividendsChart` | Bars: Изплатени дивиденти (annual) |
| `chart-dps` | `renderDividendPerShareChart` | Bars: Дивидент на акция (annual) |
| `chart-payout` | `renderPayoutRatioChart` | Line: Payout ratio % (annual) |
| `chart-eps-fcf` | `renderEPSvsFCFChart` | Bars: EPS vs FCF/share |
| `chart-bvps` | `renderBVPSChart` | Line: Book Value Per Share |

**Таблици:**
| ID | Функция | Съдържание |
|----|---------|------------|
| `income-thead/tbody` | `renderIncomeTable` | Приходи, GP, EBIT, NP, маржове |
| `balance-thead/tbody` | `renderBalanceTable` | Активи, Пари, Вземания, Капитал, Пасиви, D/E |
| `cf-thead/tbody` | `renderCashFlowTable` | OCF, Invest.CF, Financ.CF, Net Change, FCF |

---

## 7. Важни особености и аномалии

### 2021 — само годишни данни

Файлът `shelly_group_2021_Q4.json` съдържа само FY 2021 данни (от годишния отчет). В quarterly режим за 2021 се вижда само Q4 snapshot на баланса. За да се добавят тримесечни данни (Q1–Q3 2021), трябва да се създадат допълнителни JSON файлове от съответните тримесечни отчети.

### 2024 — рекласификация на данните

Q1 2025 отчетът представя сравнителни данни за 2024, рекласифицирани за сравнимост.

**Две версии на 2024:**
- `ytd_2024` / `quarterly_2024` / `balance_sheet` (index 0) — **рестатирани** (от Q1 2025 отчет)
- `ytd_2024_original` / `quarterly_2024_original` / `balance_sheet_2024_original` — **оригинални**

В app.js `getQuarterly()` и `getYTD()` използват рестатираните данни за 2024 по подразбиране.

- Dec 2024 restated total assets = **180,606**
- Dec 2024 original total assets = **183,068**

### Валутна нормализация в UI

- Дашбордът визуализира **всички абсолютни стойности в EUR**.
- За периоди **2021–2025** конверсията се прави в `app.js` при изграждане на series/balance данните: `BGN / 1.95583`.
- За периоди **2026+** не се прави конверсия; стойностите се приемат като вече въведени в EUR.
- Това правило важи и за `EPS`, `BVPS`, `FCF/share`, `DPS`, всички графики, KPI, таблици и CSV export.
- Не разчитай на `D.meta.currency` за историческа логика, защото `deepMerge()` оставя само последната заредена meta стойност.

### 2023 Q3 — аномалия в финансовите разходи

`financial_expenses` за Q3 2023 standalone = **+249** (положителна стойност) — резултат от рекласификация между Q2 и Q3 отчети. Стойността е правилна, не се коригира.

### EPS — тримесечни стойности

Изчислени като разлика на кумулативни YTD EPS: Q2 = H1 - Q1, Q3 = 9M - H1, Q4 = FY - 9M.

### Баланс — верификация

За всички snapshot-и: `Пасиви + Собствен капитал = Общо активи`. Задължително верифицирай при добавяне на нови данни.

### Дивидентни плащания — сезонност

Дружеството исторически изплаща дивиденти в Q3. В 2024 има частично плащане в Q2 (4,379 хил.) и допълнение в Q3 (211 хил.).

---

## 8. Как се добавя ново тримесечие

Пример: добавяне на **Q1 2026**.

### Стъпка 1 — Създай JSON файл директно

Създай `docs/data/shelly_group_2026_Q1.json` по образеца на съществуващите файлове.

Файлът трябва да съдържа само новите данни за 2026 — `deepMerge` ще ги обедини с останалите. От 2026 нататък числата в JSON вече са **в EUR** и не се нуждаят от допълнителна конверсия в сайта. Минимална структура:

```json
{
  "meta": { "generated_at": "YYYY-MM-DD", ... },
  "income_statement": {
    "ytd": {
      "2026": {
        "labels": ["Q1 2026 (3M)", "H1 2026 (6M)", "9M 2026", "FY 2026 (12M)"],
        "dates":  ["2026-03-31",   "2026-06-30",   "2026-09-30", "2026-12-31"],
        "months": [3, 6, 9, 12]
      }
    },
    "quarterly_labels": { "2026": ["Q1 2026", "Q2 2026", "Q3 2026", "Q4 2026"] },
    "items": {
      "revenue":       { "ytd_2026": [XXXX, null, null, null], "quarterly_2026": [XXXX, null, null, null] },
      "cogs":          { "ytd_2026": [-XXXX, null, null, null], "quarterly_2026": [-XXXX, null, null, null] },
      ...
    }
  },
  "cash_flows": { ... },
  "balance_sheet_2026": {
    "dates":  ["2025-12-31", "2026-03-31", null, null, null],
    "labels": ["31 дек 2025", "31 мар 2026", null, null, null],
    "assets": { ... },
    "liabilities": { ... },
    "equity": { ... }
  }
}
```

### Стъпка 2 — app.js

В `YEARS`:
```js
const YEARS = ['2021','2022','2023','2024','2025','2026'];
```

В `activeYears`:
```js
let activeYears = new Set(['2021','2022','2023','2024','2025','2026']);
```

В `init()` — добави зареждането на 2026 файловете (аналогично на 2022–2025 или 2021).

В `buildBalanceData()` — добави случаите за 2026 в quarterly и LTM масивите:
```js
const bs26 = D.balance_sheet_2026;
// annual:
...(bs26 ? [{ label: '2026', ...extractBSPoint(bs26, 4) }] : []),
// quarterly:
...(activeYears.has('2026') && bs26 ? [
  { label: "Q1'26", bs: bs26, i: 1 }, ...
] : []),
```

### Стъпка 3 — index.html

Добави checkbox:
```html
<label><input type="checkbox" value="2026" checked onchange="updateYearFilter()"> 2026</label>
```

### Стъпка 4 — Верифицирай

- Баланс: Пасиви + Капитал = Активи за всички нови snapshot-и
- Стартирай сървъра и провери в двата режима (quarterly и annual)

---

## 9. Как се добавя нова графика

1. **HTML** — добави canvas в подходящата секция:
```html
<div class="chart-card">
  <div class="chart-title"><span class="dot" style="background:#COLOR"></span>Заглавие</div>
  <div class="chart-desc">Описание.</div>
  <div class="chart-wrapper"><canvas id="chart-my-new"></canvas></div>
</div>
```

2. **app.js** — добави render функция:
```js
function renderMyNewChart(series) {
  const labels = series.map(s => s.label);
  mkChart('chart-my-new', {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Показател',
        data: series.map(s => /* изчисление */),
        borderColor: CHART_COLORS.blue,
        backgroundColor: CHART_COLORS.blueA,
        borderWidth: 2,
        tension: 0.3
      }]
    },
    options: {
      ...JSON.parse(JSON.stringify(BASE_CHART_OPTIONS)),
      // overrides
    }
  });
}
```

3. **refresh()** — добави извикването в правилния ред.

---

## 10. Работна среда и стартиране

### Стартиране на локален сървър

```bash
cd /Users/mac/projects/shelly/docs
python3 -m http.server 8090
# Отвори: http://localhost:8090
```

Или чрез `.claude/launch.json` (конфигуриран за порт 8090).

### Export на CSV

Бутонът **CSV** извиква `exportCSV()` — изтегля текущия изглед като UTF-8 CSV с BOM (съвместим с Excel).

### Зависимости

- **Chart.js 4.4.4** — зарежда се от CDN
- Без npm, без build процес

### CORS

JSON файловете трябва да се сервират от HTTP сървър. Директно отваряне на `index.html` от файловата система ще покаже CORS грешка.

### Деплой

Папката `docs/` може да се деплойне директно на GitHub Pages, Netlify, Vercel или всеки статичен хостинг.
