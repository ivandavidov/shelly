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

Инвеститорски финансов дашборд за **Шелли Груп АД** (BSE: SLYG, XETRA: SLYG) — Bulgarian IoT / Smart Home компания. Покрива 16 тримесечия: Q1 2022 → Q4 2025.

**Данни:** Консолидирани финансови отчети по МСФО (IFRS). Всички суми в **хиляди BGN**.

**Технологии:**
- Python 3 — парсване на PDF и генериране на JSON
- Vanilla JS + Chart.js 4.4.4 — фронтенд дашборд
- Без build step, без framework — просто static files

**Еволюция на наименованието на компанията:**
| Период | Юридическо наименование |
|--------|------------------------|
| 2022 | ALLTERCO JSCo |
| Q1 2023 | Allterco AD |
| Q2–Q4 2023 | Шелли Груп АД |
| 2024–2025 | Шелли Груп ЕД (EAD) |

---

## 2. Структура на файловете

```
/Users/mac/projects/shelly/
├── README.md
├── AGENTS.md                        ← този файл
└── docs/                            ← web root (статичен сайт)
    ├── index.html                   ← HTML структура (279 реда)
    ├── app.js                       ← цялата логика на дашборда (1510 реда)
    ├── styles.css                   ← CSS стилове (431 реда)
    ├── generate_quarterly.py        ← Python скрипт за генериране на JSON (755 реда)
    └── data/                        ← 16 JSON файла, по един на тримесечие
        ├── shelly_group_2022_Q1.json
        ├── shelly_group_2022_Q2.json
        ├── ...
        └── shelly_group_2025_Q4.json
```

Всеки JSON файл е ~100KB и съдържа **пълния набор от данни** за всички периоди, известни към момента на публикуване на съответния отчет. Браузърът зарежда всичките 16 файла и ги обединява с `deepMerge()`.

---

## 3. Поток на данните

```
PDF отчети (source_pdfs/)
       ↓  generate_quarterly.py  (ръчно въведени данни)
JSON файлове (docs/data/*.json)
       ↓  fetch() + deepMerge()  (app.js init())
Глобален обект D (in-memory)
       ↓  buildSeriesData() / buildBalanceData()
Chart.js + HTML таблици
```

### generate_quarterly.py

Скриптът **не парсва PDF автоматично**. Данните са **ръчно въведени** в Python константи след преглед на PDF отчетите. Скриптът генерира 16 JSON файла.

Структура на скрипта:
- `STATIC_META` — метаданни на компанията, ISIN, борси, изходни документи
- `SHAREHOLDERS` — акционери (ръчно актуализирано)
- `SUBSIDIARIES` — дъщерни дружества
- `INCOME_STATEMENT_ITEMS` — всеки ред от ОПР с YTD и тримесечни масиви
- `CASH_FLOW_ITEMS` — оперативни, инвестиционни, финансови потоци
- `PER_SHARE` — EPS, BVPS, брой акции
- `BALANCE_SHEETS` — 4 обекта: `2022`, `2023`, `2024_original`, `2025`
- Функция `generate_quarterly_json(year, quarter)` — генерира един файл
- Цикъл `for year in YEARS: for q in QUARTERS:` — генерира всичките 16

**Стартиране:**
```bash
cd docs/
python3 generate_quarterly.py
```

---

## 4. JSON схема

### Топ-ниво ключове (след deepMerge)

```json
{
  "meta": { ... },
  "shareholders": { ... },
  "subsidiaries": { ... },
  "income_statement": { "ytd": {...}, "items": {...} },
  "cash_flows": { "ytd": {...}, "items": {...} },
  "per_share": { "shares": {...}, "eps_ytd": {...}, "eps_quarterly": {...}, "book_value_per_share": {...} },
  "ratios": { ... },
  "balance_sheet": { ... },          ← 2025 (restated comparative 2024)
  "balance_sheet_2024_original": { ... },
  "balance_sheet_2023": { ... },
  "balance_sheet_2022": { ... }
}
```

### Масиви с данни — конвенция за индекси

Всички масиви с периодни данни са с **4 елемента** [Q1, Q2, Q3, Q4]:

```js
item.ytd_2025   = [Q1_YTD, H1_YTD, 9M_YTD, FY_YTD]   // кумулативни
item.quarterly_2025 = [Q1_standalone, Q2_standalone, Q3_standalone, Q4_standalone]
```

Изключение — **Balance Sheet** `values` масиви имат **5 елемента**:
```js
bs.assets.total.values = [PrevYearEnd, Q1_end, Q2_end, Q3_end, Q4_end]
//                          index 0       1       2       3       4
```
В `buildBalanceData()`: annual режим → индекс `4`, quarterly режим → индекси `1..4`.

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
  "quarterly_2025": [51759, 53791, 64486, 122833],
  "quarterly_2024": [40164, 41492, 45382, 81666],
  "quarterly_2024_original": [40164, 41492, 45382, 81666],
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
      "inventories": { "values": [v0, v1, v2, v3, v4] },
      "trade_receivables": { "values": [...] },
      "other_receivables": { "values": [...] },
      "cash": { "values": [...] },
      "total": { "values": [...] }
    },
    "non_current": {
      "ppe": { "values": [...] },
      "intangibles": { "values": [...] },
      "right_of_use": { "values": [...] },
      "goodwill": { "values": [...] },
      "associates": { "values": [...] },
      "deferred_tax": { "values": [...] },
      "total": { "values": [...] }
    },
    "total": { "values": [...] }
  },
  "liabilities": {
    "current": {
      "bank_loans": { "values": [...] },
      "lease_st": { "values": [...] },
      "trade_payables": { "values": [...] },
      "employee_st": { "values": [...] },
      "other": { "values": [...] },
      "total": { "values": [...] }
    },
    "non_current": {
      "lease_lt": { "values": [...] },
      "employee_lt": { "values": [...] },
      "total": { "values": [...] }
    },
    "total": { "values": [...] }
  },
  "equity": {
    "share_capital": { "values": [...] },
    "retained_earnings": { "values": [...] },
    "premium_reserve": { "values": [...] },
    "legal_reserves": { "values": [...] },
    "sbp_reserve": { "values": [...] },
    "fx_translation": { "values": [...] },
    "equity_to_parent": { "values": [...] },
    "nci": { "values": [...] },
    "total": { "values": [...] }
  }
}
```

### Брой акции

```js
D.per_share.shares = {
  "q1_q2_2025": 18105559,
  "q3_q4_2025": 18157559,
  "2024":       18105559,
  "2023":       18000000,
  "2022":       18000000
}
```

Функции в app.js:
- `getShareCount(year, quarter)` — за quarterly/LTM режим (quarter = 1..4)
- `getShareCountAnnual(year)` — за annual режим

### Дивиденти

```js
D.cash_flows.items.financing.dividends_paid = {
  ytd_2025: [0, 0, -4603, -4603],  // изплатени в Q3
  ytd_2024: [0, -4379, -4590, -4590],
  ytd_2023: [0, 0, -4500, -4500],
  ytd_2022: [0, 0, -1719, -1719]
}
```
Стойностите са **отрицателни** (изходящи плащания). Използвай `Math.abs()`.

### BVPS (Book Value Per Share)

```js
D.per_share.book_value_per_share = {
  dates: ["2024-12-31", "2025-03-31", ...],
  values: [8.24, 8.87, 9.13, 10.01, 11.47],       // 2025 (index 0 = Q4 2024 opening)
  dates_2024_original: ["2023-12-31", ...],
  values_2024_original: [6.09, 6.51, 6.77, 7.28, 8.26]  // 2024
}
```
За 2022 и 2023, BVPS се изчислява в app.js от `equity.equity_to_parent / shares`.

---

## 5. Архитектура на дашборда

### Глобално състояние

```js
let D = null;              // обединен обект с всички данни (след deepMerge)
let currentMode = 'quarterly';  // 'quarterly' | 'annual' | 'ltm'
let activeYears = new Set(['2022','2023','2024','2025']);
const charts = {};         // { canvasId: Chart instance }
```

### Инициализация (init())

1. Зарежда 16 JSON файла паралелно с `Promise.all()`
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

Всеки елемент на масива има:
```js
{
  label,          // напр. "Q1'25" / "2025" / "LTM Q4'25"
  yr,             // "2022"|"2023"|"2024"|"2025"
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
  bank_loans,       // само краткосрочни банкови заеми
  lease_st, lease_lt,
  trade_payables,
  cash, recv,       // recv = trade_receivables
  inventories,
  re                // retained_earnings
}
```

### LTM режим

- Строи `allQuarters` масив от всичките 16 тримесечия
- Слайдинг прозорец от 4 квартала (i-3 .. i)
- Сумира всички income/CF стойности
- **Balance sheet** в LTM режим показва момента стойности (не суми) — snapshot към края на последното тримесечие в прозореца
- LTM EPS = сума от 4 тримесечни EPS стойности

### refresh()

Главната функция, извиквана при промяна на mode или year filter. Извиква всички `render*` функции в ред:

```
buildSeriesData() + buildBalanceData()
  → updateKPIs()
  → renderRevenueChart()
  → renderMarginsChart()
  → renderYoYGrowthChart()    ← нова
  → renderExpenseBreakdownChart()
  → renderCashflowChart()
  → renderFCFChart()
  → renderInterestCoverageChart()
  → renderEarningsQualityChart()
  → renderBalanceChart()
  → renderAssetGrowthChart()
  → renderNetDebtChart()      ← нова
  → renderLiquidityChart()
  → renderDuPontChart()       ← фиксирана с реални данни
  → renderReceivablesChart()
  → renderSeasonalityChart()
  → renderWorkingCapitalChart() ← нова
  → renderDividendsChart()    ← нова (annual only)
  → renderDividendPerShareChart() ← нова (annual only)
  → renderPayoutRatioChart()  ← нова (annual only)
  → renderEPSvsFCFChart()
  → renderBVPSChart()         ← нова
  → renderIncomeTable()
  → renderBalanceTable()
  → renderCashFlowTable()     ← нова
  → renderStockInfo()         ← нова
```

### mkChart(id, config)

Стандартният начин за създаване/обновяване на графика:
```js
function mkChart(id, config) {
  const ctx = document.getElementById(id).getContext('2d');
  if (charts[id]) charts[id].destroy();  // унищожава старата
  charts[id] = new Chart(ctx, config);
  return charts[id];
}
```

### BASE_CHART_OPTIONS

Трябва **задължително** да се deep clone преди употреба:
```js
options: {
  ...JSON.parse(JSON.stringify(BASE_CHART_OPTIONS)),
  // custom overrides...
}
```

---

## 6. Графики и таблици

| Canvas ID | Функция | Секция | Описание |
|-----------|---------|--------|----------|
| `chart-revenue` | `renderRevenueChart` | Приходи | Bars: Приходи + Нетна печалба |
| `chart-margins` | `renderMarginsChart` | Приходи | Lines: Брутен/EBIT/Нетен марж % |
| `chart-yoy-growth` | `renderYoYGrowthChart` | Приходи | Lines: Растеж г/г % |
| `chart-expense-breakdown` | `renderExpenseBreakdownChart` | Приходи | Stacked bars: разходна структура |
| `chart-cashflow` | `renderCashflowChart` | CF | Bars: OCF / FCF / Нетна промяна |
| `chart-fcf` | `renderFCFChart` | CF | Bars: FCF (зелено/червено) |
| `chart-interest-coverage` | `renderInterestCoverageChart` | CF | Bars: EBIT / Fin.Exp (x) |
| `chart-earnings-quality` | `renderEarningsQualityChart` | CF | Line: OCF / Net Profit |
| `chart-balance` | `renderBalanceChart` | Баланс | Stacked bars: Капитал + Пасиви |
| `chart-asset-growth` | `renderAssetGrowthChart` | Баланс | Lines: Активи / Капитал / Пари |
| `chart-net-debt` | `renderNetDebtChart` | Баланс | Bar+Line: Нетен дълг + D/E |
| `chart-liquidity` | `renderLiquidityChart` | Баланс | Lines: Current / Quick ratio |
| `chart-dupont` | `renderDuPontChart` | Баланс | Lines: ROE decomposition |
| `chart-receivables` | `renderReceivablesChart` | Ефективност | Line: Дни вземания |
| `chart-seasonality` | `renderSeasonalityChart` | Ефективност | Grouped bars: Q1-Q4 по години |
| `chart-working-capital` | `renderWorkingCapitalChart` | Ефективност | Lines: Inventory/Recv/Pay days + CCC |
| `chart-dividends` | `renderDividendsChart` | Дивиденти | Bars: Изплатени дивиденти (annual) |
| `chart-dps` | `renderDividendPerShareChart` | Дивиденти | Bars: Дивидент на акция (annual) |
| `chart-payout` | `renderPayoutRatioChart` | Дивиденти | Line: Payout ratio % (annual) |
| `chart-eps-fcf` | `renderEPSvsFCFChart` | Per Share | Bars: EPS vs FCF/share |
| `chart-bvps` | `renderBVPSChart` | Per Share | Line: Book Value Per Share |

**Таблици:**
| ID | Функция | Съдържание |
|----|---------|------------|
| `income-thead/tbody` | `renderIncomeTable` | Приходи, GP, EBIT, NP, маржове |
| `balance-thead/tbody` | `renderBalanceTable` | Активи, Пари, Вземания, Капитал, Пасиви, D/E |
| `cf-thead/tbody` | `renderCashFlowTable` | OCF, Invest.CF, Financ.CF, Net Change, FCF |

---

## 7. Важни особености и аномалии

### 2024 — рекласификация на данните

**Проблем:** Q1 2025 отчетът представя сравнителни данни за 2024, рекласифицирани за сравнимост.

**Решение — две версии на 2024:**
- `ytd_2024` / `quarterly_2024` / `balance_sheet` (index 0) — **рестатирани** данни (от Q1 2025 отчет)
- `ytd_2024_original` / `quarterly_2024_original` / `balance_sheet_2024_original` — **оригинални** данни от 2024 отчети

В app.js `getQuarterly()` и `getYTD()` използват рестатираните данни за 2024 по подразбиране.

- Dec 2024 restated total assets = **180,606**
- Dec 2024 original total assets = **183,068**

### 2023 Q3 — аномалия в финансовите разходи

`financial_expenses` за Q3 2023 standalone = **+249** (положителна стойност). Това е резултат от преизчисляване/рекласификация между Q2 и Q3 отчети. Стойността е **правилна** — не трябва да се коригира.

### EPS — изчисляване на тримесечни стойности

Тримесечните EPS стойности (`quarterly_2022`, `quarterly_2023`) са изчислени като разлика на кумулативни YTD EPS:
- Q2 = H1 EPS - Q1 EPS
- Q3 = 9M EPS - H1 EPS
- Q4 = FY EPS - 9M EPS

### Share premium в H1 2023

PDF показва 5,043 хил. за дялова премия (share premium), но правилната стойност (верифицирана чрез L+E=A) е **5,403 хил.**

### Баланс — верификация

За всички 20 тримесечни snapshot-а: `Пасиви + Собствен капитал = Общо активи`. Ако добавяш нови данни, задължително верифицирай.

### Инвестиционен CF в quarterly режим

CAPEX е в JSON само като YTD масив. Тримесечните стойности се изчисляват като разлика:
```js
cfCapQ[i] = ytd[i] - ytd[i-1]   // за i > 0
cfCapQ[0] = ytd[0]               // Q1 = директно
```

### Дивидентни плащания — сезонност

Дружеството исторически изплаща дивиденти в Q3 (юли-септември). В 2024 има частично плащане в Q2 (4,379 хил.) и допълнение в Q3 (211 хил.).

---

## 8. Как се добавя ново тримесечие

Пример: добавяне на **Q1 2026**.

### Стъпка 1 — generate_quarterly.py

Намери константата за всеки item и добави `ytd_2026` и `quarterly_2026` ключове:

```python
# В INCOME_STATEMENT_ITEMS["revenue"]:
"ytd_2026": [XXXX, None, None, None],
"quarterly_2026": [XXXX, None, None, None],
```

Добави новия `balance_sheet_2026` обект (или добави Q1 2026 данни към `balance_sheet`).

Добави нов запис в `STATIC_META["source_documents"]`.

### Стъпка 2 — Генерирай JSON

```bash
cd docs/
python3 generate_quarterly.py
```

Проверявай: новият файл `shelly_group_2026_Q1.json` трябва да е в `data/`.

### Стъпка 3 — app.js

В константата `YEARS`:
```js
const YEARS = ['2022','2023','2024','2025','2026'];
```

В `init()`:
```js
const years = ['2022', '2023', '2024', '2025', '2026'];
```

В HTML `index.html` — добави checkbox:
```html
<label><input type="checkbox" value="2026" checked onchange="updateYearFilter()"> 2026</label>
```

В `buildBalanceData()` — добави случая за 2026 в quarterly и LTM масивите.

### Стъпка 4 — Верифицирай

Стартирай сървъра и провери в quarterly режим с 2026 включено.

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
        ...
      }]
    },
    options: {
      ...JSON.parse(JSON.stringify(BASE_CHART_OPTIONS)),
      // overrides
    }
  });
}
```

3. **refresh()** — добави извикването:
```js
renderMyNewChart(series);
```

---

## 10. Работна среда и стартиране

### Стартиране на локален сървър

```bash
cd /Users/mac/projects/shelly/docs
python3 -m http.server 8090
# Отвори: http://localhost:8090
```

Или чрез `.claude/launch.json` (вече конфигуриран за порт 8090).

### Export на CSV

Бутонът **CSV** в контролната лента извиква `exportCSV()` — изтегля текущия изглед като UTF-8 CSV с BOM (съвместим с Excel).

### Зависимости

- **Chart.js 4.4.4** — зарежда се от CDN: `cdn.jsdelivr.net/npm/chart.js@4.4.4/`
- **Python 3.x** — само за generate_quarterly.py (стандартна библиотека, без допълнителни пакети)
- Без npm, без build процес

### CORS

JSON файловете трябва да се сервират от HTTP сървър. Директно отваряне на `index.html` от файловата система ще покаже грешка за CORS.

### Деплой

Проектът е изцяло статичен. Папката `docs/` може да се деплойне директно на:
- GitHub Pages (`/docs` папка)
- Netlify / Vercel (drag-and-drop)
- Всеки статичен хостинг
