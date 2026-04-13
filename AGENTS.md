# AGENTS.md — Финансов дашборд (multi-company)

Пълна документация за структурата, данните и логиката на проекта. Предназначена за AI агенти и разработчици, които поддържат или разширяват дашборда.

---

## Съдържание

1. [Обзор на проекта](#1-обзор-на-проекта)
2. [Структура на файловете](#2-структура-на-файловете)
3. [Поток на данните](#3-поток-на-данните)
4. [CSV схема](#4-csv-схема)
5. [Архитектура на дашборда](#5-архитектура-на-дашборда)
6. [Графики и таблици](#6-графики-и-таблици)
7. [Важни особености](#7-важни-особености)
8. [Как се добавя ново тримесечие](#8-как-се-добавя-ново-тримесечие)
9. [Как се добавя нова компания](#9-как-се-добавя-нова-компания)
10. [Как се добавя нова графика](#10-как-се-добавя-нова-графика)
11. [Работна среда и стартиране](#11-работна-среда-и-стартиране)

---

## 1. Обзор на проекта

Инвеститорски финансов дашборд — статичен уебсайт, визуализиращ тримесечни и годишни финансови отчети. Поддържа **множество компании** чрез URL параметър `?company=<id>`.

По подразбиране (без параметър) се зарежда **Шелли Груп АД** (BSE: SLYG, XETRA: SLYG).

**Данни:** Консолидирани финансови отчети по МСФО (IFRS). Данните за Шелли до 31.12.2025 са в **хиляди BGN** и се конвертират в **хиляди EUR** (÷ 1.95583). Данните от 2026 нататък се въвеждат директно в EUR.

**Технологии:**
- Vanilla JS + Chart.js 4.4.4 — фронтенд дашборд
- Python 3 — генератор на CSV данни
- Без build step, без npm, без framework — само static files

---

## 2. Структура на файловете

```
shelly/
├── AGENTS.md                            ← този файл
├── docs/                                ← web root (статичен сайт)
│   ├── index.html                       ← HTML структура (company-agnostic)
│   ├── styles.css                       ← CSS стилове
│   ├── app.js                           ← цялата логика на дашборда
│   └── companies/
│       └── shelly/
│           ├── meta.json                ← метаданни за компанията
│           └── data.csv                 ← финансови данни (генериран файл)
│
└── financial_data/                      ← Python pipeline за данни
    ├── AGENTS.md                        ← документация за pipeline-а
    ├── generate_csv.py                  ← генератор (company-agnostic)
    ├── validate.py                      ← валидатор (company-agnostic)
    └── shelly/                          ← extract скриптове за Шелли
        ├── extract_q1_2021.py
        ├── ...
        ├── extract_q4_2025.py
        └── output/                      ← генерирани CSV файлове
            ├── shelly_annual.csv
            ├── shelly_quarterly_YYYY.csv
            └── shelly_quarterly_all.csv
```

---

## 3. Поток на данните

> **Подробна документация за Python pipeline-а** (extract скриптове, речник на ключовете, валидационни проверки, пълни работещи примери) се намира в [`financial_data/AGENTS.md`](financial_data/AGENTS.md).

```
PDF отчет (четен ръчно)
       ↓  ръчно кодиране
financial_data/shelly/extract_qX_YYYY.py
       ↓  python3 generate_csv.py shelly
financial_data/shelly/output/shelly_quarterly_all.csv
       ↓  автоматично копиране
docs/companies/shelly/data.csv
       ↓  fetch() в браузъра
app.js parseCSV() → csvData{}
       ↓  buildSeriesData() / buildBalanceData()
Chart.js + HTML таблици
```

### Стъпки при добавяне на нови данни

1. Кодирайте данните в `financial_data/shelly/extract_qX_YYYY.py`
2. `python3 financial_data/generate_csv.py shelly`
3. Файлът `docs/companies/shelly/data.csv` се обновява автоматично

---

## 4. CSV схема

### Формат на файла

`data.csv` е UTF-8 с BOM, с 60+ реда и колони за всяко тримесечие:

```
раздел,счетоводен_ред,Q1 2021 (3М),Q2 2021 (6М),...,Q4 2025 (12М)
Приходи и разходи,Приходи от продажби,14993,,,…
Приходи и разходи,Себестойност на продажбите,,,…
...
```

**Колони 1–2:** `раздел` и `счетоводен_ред` (идентификатори на реда)

**Колони 3+:** период в формат `Q{q} {YYYY} ({месеца}М)` — напр. `Q1 2024 (3М)`, `Q4 2025 (12М)`

Стойностите са **YTD кумулативни** (от началото на годината). Дашбордът изчислява standalone тримесечни стойности чрез разлика: Q2_standalone = Q2_YTD − Q1_YTD.

**Изключение:** Балансови редове (раздели „Активи", „Пасиви", „Собствен капитал") са **моментни стойности** (snapshot), не YTD.

### Единица и валута

- Всички стойности: **хиляди BGN** (за Шелли до 2025)
- Разходите са **отрицателни числа**
- EPS: в лева на акция (не в хиляди)
- Конверсията BGN→EUR се управлява от `meta.json`

### Ключови редове (счетоводен_ред)

| Ред в CSV | Описание |
|-----------|----------|
| `Приходи от продажби` | Revenue |
| `Себестойност на продажбите` | COGS |
| `Брутна печалба` | Gross profit |
| `Разходи за продажби` | Selling expenses |
| `Административни разходи` | Administrative expenses |
| `Печалба от оперативна дейност (EBIT)` | EBIT |
| `Финансови приходи` | Financial income |
| `Финансови разходи` | Financial expenses |
| `Печалба преди данъци (EBT)` | EBT |
| `Нетна печалба` | Net profit |
| `Нетен доход на акция (EPS, лв.)` | EPS |
| `Пари и парични еквиваленти` | Cash |
| `Търговски вземания` | Trade receivables |
| `Материални запаси` | Inventories |
| `Общо текущи активи` | Current assets |
| `Общо нетекущи активи` | Non-current assets |
| `ОБЩО АКТИВИ` | Total assets |
| `Търговски задължения` | Trade payables |
| `Банкови заеми` | Bank loans (current) |
| `Задължения по лизинг (краткосрочни)` | Lease liabilities (ST) |
| `Задължения по лизинг (дългосрочни)` | Lease liabilities (LT) |
| `Общо текущи пасиви` | Current liabilities |
| `Общо нетекущи пасиви` | Non-current liabilities |
| `ОБЩО ПАСИВИ` | Total liabilities |
| `ОБЩО СОБСТВЕН КАПИТАЛ` | Total equity |
| `Нетни парични потоци от оперативна дейност` | Operating CF |
| `Капиталови разходи (CAPEX)` | CAPEX |
| `Нетни парични потоци от инвестиционна дейност` | Investing CF |
| `Изплатени дивиденти` | Dividends paid |
| `Нетни парични потоци от финансова дейност` | Financing CF |
| `Пари в началото на периода` | Cash at start |
| `Пари в края на периода` | Cash at end |

---

## 5. Архитектура на дашборда

### Глобално състояние (app.js)

```js
let csvData   = {};         // { "Приходи от продажби": { "Q1 2021 (3М)": "14993", ... }, ... }
let periods   = [];         // [{ q, year, months, key, colIdx }, ...]
let allYears  = [];         // ["2021", "2022", ..., "2025"]
let activeYears = new Set();// текущо активни години (от checkboxes)
let currentMode = 'quarterly'; // 'quarterly' | 'annual' | 'ltm'
let meta      = {};         // съдържание на meta.json
const charts  = {};         // { canvasId: Chart instance }

// Конфигурируеми чрез meta.json:
let BGN_PER_EUR          = 1.95583;
let EUR_TRANSITION_YEAR  = 2026;
let DISPLAY_AMOUNT_UNIT  = 'хил. EUR';
let DISPLAY_PER_SHARE_UNIT = 'EUR';
```

### Инициализация (init())

1. Чете `?company=` от URL (default: `'shelly'`)
2. Зарежда `companies/{id}/meta.json` → `applyMeta()` → попълва заглавие, тикери, footer, currency константи
3. Зарежда `companies/{id}/data.csv` → `parseCSV()` → `csvData`
4. Открива периодите и годините от заглавния ред на CSV
5. Генерира динамично checkboxes за години (последните 4 са активни по подразбиране)
6. Извиква `refresh()`

### meta.json схема

```json
{
  "id":          "shelly",
  "name":        "Шелли Груп АД",
  "subtitle":    "Финансов дашборд за инвеститори",
  "logo_letter": "S",
  "tickers": [
    { "label": "BSE: SLYG", "url": "https://..." }
  ],
  "info": {
    "Борса":  "BSE Sofia / XETRA",
    "Тикър":  "SLYG",
    "ISIN":   "BG1100003166",
    "Сектор": "IoT / Smart Home",
    "ЕИК":    "175440738"
  },
  "currency": {
    "source":       "BGN",
    "display":      "EUR",
    "display_unit": "хил. EUR",
    "rate_bgn_eur": 1.95583,
    "eur_from_year": 2026
  },
  "footer":    "Бележка под линия за страницата.",
  "data_file": "data.csv"
}
```

### Основни функции

| Функция | Описание |
|---------|----------|
| `getCompanyId()` | Чете `?company=` от URL; default `'shelly'` |
| `applyMeta(m)` | Попълва DOM и override-ва currency константите |
| `parseCSV(text)` | Парсва CSV текст; връща 2D масив |
| `csv(label, periodKey)` | Чете стойност от `csvData`; конвертира BGN→EUR ако е нужно |
| `buildSeriesData()` | Строи масив за текущия mode (quarterly/annual/LTM) |
| `buildBalanceData()` | Строи масив от BS snapshot обекти |
| `refresh()` | Главна функция — извиква всички render* при смяна на mode/years |
| `mkChart(id, config)` | Destroy + create Chart.js инстанция |

### csv() — конверсия BGN→EUR

```js
function csv(label, periodKey) {
  const raw = csvData[label]?.[periodKey];
  const val = parseFloat(raw);
  if (isNaN(val)) return null;
  const year = parseInt(periodKey.match(/(\d{4})/)?.[1]);
  return (year && year < EUR_TRANSITION_YEAR) ? val / BGN_PER_EUR : val;
}
```

### buildSeriesData() — изходен обект

```js
{
  label,           // напр. "Q1'25" / "2025" / "LTM Q4'25"
  revenue, net_profit, gross_profit, ebit,
  cogs, sell_exp, admin_exp, other_exp,
  fin_inc, fin_exp,
  cf_op, cf_fcf, cf_net, capex,
  dividends,
  eps
}
```

### buildBalanceData() — изходен обект

```js
{
  label,
  assets, liabilities, equity,
  current_assets, current_liab,
  cash, recv, inventories,
  trade_payables,
  bank_loans, lease_st, lease_lt,
  nc_liab, nc_assets
}
```

### Quarterly vs Annual vs LTM

- **Quarterly:** standalone Q стойности = YTD(Q) − YTD(Q-1); за Q1 = YTD директно
- **Annual:** Q4 YTD стойности = FY стойности
- **LTM:** сума на последните 4 standalone тримесечия (само IS/CF); BS = последен snapshot
- **Баланс:** винаги моментни (point-in-time) стойности — не се сумират

### Брой акции

Изчислява се динамично от CSV: `shares = (annual_net_profit / annual_EPS) * 1000`

Без хардкодирани стойности — работи за всяка компания.

---

## 6. Графики и таблици

| Canvas ID | Render функция | Описание |
|-----------|---------------|----------|
| `chart-revenue` | `renderRevenueChart` | Bars: Приходи + Нетна печалба |
| `chart-margins` | `renderMarginsChart` | Lines: Брутен/EBIT/Нетен марж % |
| `chart-yoy-growth` | `renderYoYGrowthChart` | Lines: Растеж г/г % |
| `chart-expense-breakdown` | `renderExpenseBreakdownChart` | Stacked bars: разходна структура |
| `chart-cashflow` | `renderCashflowChart` | Bars: OCF / Invest.CF / Financ.CF |
| `chart-fcf` | `renderFCFChart` | Bars: FCF (зелено/червено) |
| `chart-interest-coverage` | `renderInterestCoverageChart` | Bar: EBIT / Fin.Exp (x) |
| `chart-earnings-quality` | `renderEarningsQualityChart` | Line: OCF / Net Profit |
| `chart-balance` | `renderBalanceChart` | Stacked bars: Капитал + Пасиви |
| `chart-asset-growth` | `renderAssetGrowthChart` | Lines: Активи / Капитал / Пари |
| `chart-net-debt` | `renderNetDebtChart` | Bar+Line: Нетен дълг + D/E |
| `chart-liquidity` | `renderLiquidityChart` | Lines: Current / Quick ratio |
| `chart-dupont` | `renderDuPontChart` | Lines: ROE decomposition |
| `chart-receivables` | `renderReceivablesChart` | Line: Дни вземания |
| `chart-seasonality` | `renderSeasonalityChart` | Grouped bars: Q1–Q4 по години |
| `chart-working-capital` | `renderWorkingCapitalChart` | Lines: Inventory/Recv/Pay days + CCC |
| `chart-dividends` | `renderDividendsChart` | Bars: Изплатени дивиденти |
| `chart-dps` | `renderDividendPerShareChart` | Bars: Дивидент на акция |
| `chart-payout` | `renderPayoutRatioChart` | Line: Payout ratio % |
| `chart-eps-fcf` | `renderEPSvsFCFChart` | Bars: EPS vs FCF/акция |
| `chart-bvps` | `renderBVPSChart` | Line: Book Value Per Share |

**Таблици:**

| ID | Render функция | Съдържание |
|----|---------------|------------|
| `income-thead/tbody` | `renderIncomeTable` | Приходи, GP, EBIT, NP, маржове |
| `balance-thead/tbody` | `renderBalanceTable` | Активи, Пари, Вземания, Капитал, Пасиви, D/E |
| `cf-thead/tbody` | `renderCashFlowTable` | OCF, Invest.CF, Financ.CF, Net Change, FCF |

---

## 7. Важни особености

### Q1 2021 — ограничени данни (НСС формат)

`extract_q1_2021.py` е от стар НСС формат (не МСФО). Функционален IS (COGS, GP, разходи) не е наличен — само агрегирани суми. Колоните за тези редове са празни за Q1 2021.

### YTD стойности — standalone изчисление

```js
// Q2 standalone = Q2 YTD − Q1 YTD
const q2 = csv(row, "Q2 2024 (6М)") - csv(row, "Q1 2024 (3М)");
// Q1 standalone = Q1 YTD (директно)
const q1 = csv(row, "Q1 2024 (3М)");
```

### Валутна конверсия

```
year < EUR_TRANSITION_YEAR (2026) → стойност / BGN_PER_EUR (1.95583)
year ≥ 2026                       → стойност директно (вече EUR)
```

Това важи за всички суми: графики, KPI, таблици, CSV export.

### Нетен дълг

```js
net_debt = bank_loans + lease_st + lease_lt - cash
// bank_loans_lt = nc_liab - lease_lt - nc_employee (нямаме отделен ред)
```

### Брой акции — динамично

```js
// От annual EPS и net_profit:
shares = (annual_net_profit / annual_EPS) * 1000
// (EPS е в лева, net_profit е в хиляди → * 1000)
```

### Дивиденти

В CSV дивидентите са **отрицателни** (изходящи плащания). При визуализация се използва `Math.abs()`.

---

## 8. Как се добавя ново тримесечие

Пример: добавяне на **Q1 2026** за Шелли.

### Стъпка 1 — Кодирайте данните

Създайте `financial_data/shelly/extract_q1_2026.py` по образеца на `extract_q1_2025.py`.

От 2026 нататък числата се въвеждат директно в **EUR** (не BGN).

```python
meta = {
    "дружество":      "Шелли Груп АД",
    "период":         "Q1 2026 (3М)",
    "края_на_период": "2026-03-31",
    "валута":         "хил. EUR",    # ← EUR, не BGN
}
income_statement = { "приходи_от_продажби": XXXX, ... }
balance_sheet    = { "общо_активи": XXXX, ... }
cash_flows       = { "нетни_потоци_оперативна": XXXX, ... }

def get_data():
    return {"meta": meta, "income_statement": income_statement,
            "balance_sheet": balance_sheet, "cash_flows": cash_flows}
```

### Стъпка 2 — Генерирайте CSV

```bash
python3 financial_data/generate_csv.py shelly
```

Скриптът автоматично засича 2026 и копира обновения `data.csv` в `docs/companies/shelly/data.csv`.

### Стъпка 3 — Верифицирайте

```bash
python3 financial_data/validate.py shelly
```

Проверете: Пасиви + Капитал = Активи за новия период.

### Стъпка 4 — Тествайте в браузъра

```bash
cd docs && python3 -m http.server 8090
# http://localhost:8090/?company=shelly
```

---

## 9. Как се добавя нова компания

### Стъпка 1 — Кодирайте данните

```bash
mkdir financial_data/<company_id>
# Създайте extract_q1_YYYY.py … extract_q4_YYYY.py по образеца на shelly/
```

### Стъпка 2 — Генерирайте CSV

```bash
python3 financial_data/generate_csv.py <company_id>
```

### Стъпка 3 — Метаданни

Създайте `docs/companies/<company_id>/meta.json`:

```json
{
  "id":          "<company_id>",
  "name":        "Компания АД",
  "subtitle":    "Финансов дашборд",
  "logo_letter": "К",
  "tickers": [{ "label": "BSE: TICK", "url": "https://..." }],
  "info": { "Борса": "...", "Тикър": "...", "ISIN": "...", "Сектор": "..." },
  "currency": {
    "source": "BGN", "display": "EUR", "display_unit": "хил. EUR",
    "rate_bgn_eur": 1.95583, "eur_from_year": 2026
  },
  "footer": "Бележка.",
  "data_file": "data.csv"
}
```

### Стъпка 4 — Отворете в браузъра

```
http://localhost:8090/?company=<company_id>
```

---

## 10. Как се добавя нова графика

### HTML (index.html)

```html
<div class="chart-card">
  <div class="chart-title"><span class="dot" style="background:#COLOR"></span>Заглавие</div>
  <div class="chart-desc">Описание.</div>
  <div class="chart-wrapper"><canvas id="chart-my-new"></canvas></div>
</div>
```

### app.js

```js
function renderMyNewChart(series) {
  mkChart('chart-my-new', {
    type: 'bar',
    data: {
      labels: series.map(s => s.label),
      datasets: [{
        label: 'Показател',
        data: series.map(s => s.revenue),   // или друг ключ
        backgroundColor: COLORS.blue,
      }]
    },
    options: { ...JSON.parse(JSON.stringify(BASE_CHART_OPTIONS)) }
  });
}
```

### refresh()

Добавете извикването в правилния ред:
```js
renderMyNewChart(series);
```

---

## 11. Работна среда и стартиране

### Стартиране на локален сървър

```bash
cd /Users/mac/projects/shelly/docs
python3 -m http.server 8090
# Шелли:         http://localhost:8090/
# Друга компания: http://localhost:8090/?company=<id>
```

### Пълен workflow за нови данни

```bash
# 1. Кодирайте данните в financial_data/<company>/extract_qX_YYYY.py
# 2. Генерирайте и копирайте CSV:
python3 financial_data/generate_csv.py <company>
# 3. Валидирайте:
python3 financial_data/validate.py <company>
# 4. Тествайте в браузъра
```

### Export на CSV

Бутонът **CSV** извиква `exportCSV()` — изтегля текущия изглед като UTF-8 CSV с BOM (съвместим с Excel).

### Зависимости

- **Chart.js 4.4.4** — зарежда се от CDN
- **Python 3** — за `generate_csv.py` и `validate.py`
- Без npm, без build процес

### CORS

`data.csv` трябва да се сервира от HTTP сървър. Директното отваряне на `index.html` от файловата система ще покаже CORS грешка.

### Деплой

Папката `docs/` може да се деплойне директно на GitHub Pages, Netlify, Vercel или всеки статичен хостинг.
