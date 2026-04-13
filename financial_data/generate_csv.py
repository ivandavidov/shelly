"""
Генератор на обединена CSV таблица — company-agnostic
======================================================
Генерира три файла в директория <company>/output/:

  <company>_annual.csv
      Годишни (FY) данни, колони: <first_year> … <last_year>

  <company>_quarterly_YYYY.csv
      YTD тримесечни данни само за съответната година,
      колони: Q1 YYYY (3М) … Q4 YYYY (12М)

  <company>_quarterly_all.csv
      YTD тримесечни данни за ВСИЧКИ налични години,
      колони: Q1 <first_year> (3М) … Q4 <last_year> (12М)

След генериране файлът <company>_quarterly_all.csv се копира
автоматично в docs/companies/<company>/data.csv.

Годините се засичат автоматично от наличните extract_qX_YYYY.py
файлове в директорията на компанията — не е нужно ръчно да се
поддържа списък.

Използване:
  python3 generate_csv.py --company shelly
  python3 generate_csv.py shelly            (positional)
"""

import argparse
import csv
import glob
import importlib
import os
import re
import shutil
import sys


# ── CLI аргументи ─────────────────────────────────────────────────────────────

def parse_args():
    parser = argparse.ArgumentParser(
        description="Генерира CSV файлове от extract_qX_YYYY.py скриптове за дадена компания."
    )
    parser.add_argument(
        "company",
        nargs="?",
        help="ID на компанията (поддиректория в financial_data/, напр. 'shelly')",
    )
    parser.add_argument(
        "--company", "-c",
        dest="company_flag",
        help="ID на компанията (алтернатива на позиционния аргумент)",
    )
    args = parser.parse_args()
    company = args.company_flag or args.company
    if not company:
        parser.error(
            "Моля, посочете ID на компанията: python3 generate_csv.py --company shelly"
        )
    return company


# ── Конфигурация ──────────────────────────────────────────────────────────────

QUARTER_SUFFIX = {1: "3М", 2: "6М", 3: "9М", 4: "12М"}

# Дефиниция на редовете (раздел, етикет, ключ) — споделена за всички компании
# Добавете нови редове тук ако е нужно за специфична компания.
ROWS = [
    # Отчет за всеобхватния доход
    ("Приходи и разходи", "Приходи от продажби",                       "приходи_от_продажби"),
    ("Приходи и разходи", "Себестойност на продажбите",                "себестойност_на_продажбите"),
    ("Приходи и разходи", "Брутна печалба",                            "брутна_печалба"),
    ("Приходи и разходи", "Други приходи от дейността",               "други_приходи_от_дейността"),
    ("Приходи и разходи", "Разходи за продажби",                       "разходи_за_продажби"),
    ("Приходи и разходи", "Административни разходи",                   "административни_разходи"),
    ("Приходи и разходи", "Други разходи за дейността",               "други_разходи_за_дейността"),
    ("Приходи и разходи", "Печалба от оперативна дейност (EBIT)",      "печалба_от_оперативна_дейност_ebit"),
    ("Приходи и разходи", "Финансови приходи",                         "финансови_приходи"),
    ("Приходи и разходи", "Финансови разходи",                         "финансови_разходи"),
    ("Приходи и разходи", "Дял от печалбата на асоциирани дружества",  "дял_асоциирани_дружества"),
    ("Приходи и разходи", "Печалба преди данъци (EBT)",                "печалба_преди_данъци_ebt"),
    ("Приходи и разходи", "Разход за данъци",                          "разход_за_данъци"),
    ("Приходи и разходи", "Нетна печалба от продължаващи дейности",    "нетна_печалба_продължаващи"),
    ("Приходи и разходи", "Печалба от преустановени дейности",         "печалба_преустановени_дейности"),
    ("Приходи и разходи", "Нетна печалба",                             "нетна_печалба"),
    ("Приходи и разходи", "Друг всеобхватен доход (OCI) — общо",       "общо_oci"),
    ("Приходи и разходи", "Общо всеобхватен доход",                    "общо_всеобхватен_доход"),
    ("Приходи и разходи", "Нетен доход на акция (EPS, лв.)",           "нетен_доход_на_акция_eps"),
    # Баланс — активи
    ("Активи", "Имоти, машини и съоръжения",                           "имоти_машини_съоръжения"),
    ("Активи", "Нематериални активи",                                  "нематериални_активи"),
    ("Активи", "Активи с право на ползване",                           "активи_с_право_на_ползване"),
    ("Активи", "Репутация",                                            "репутация"),
    ("Активи", "Инвестиции в асоциирани дружества",                    "инвестиции_асоциирани"),
    ("Активи", "Активи по отсрочени данъци",                           "активи_отсрочени_данъци"),
    ("Активи", "Общо нетекущи активи",                                 "общо_нетекущи_активи"),
    ("Активи", "Материални запаси",                                    "материални_запаси"),
    ("Активи", "Търговски вземания",                                   "търговски_вземания"),
    ("Активи", "Други вземания",                                       "други_вземания"),
    ("Активи", "Пари и парични еквиваленти",                           "пари_и_парични_еквиваленти"),
    ("Активи", "Общо текущи активи",                                   "общо_текущи_активи"),
    ("Активи", "ОБЩО АКТИВИ",                                          "общо_активи"),
    # Баланс — пасиви
    ("Пасиви", "Задължения по лизинг (дългосрочни)",                   "лизинг_задължения_дългосрочни"),
    ("Пасиви", "Дългосрочни задължения към персонала",                 "дългосрочни_задължения_персонал"),
    ("Пасиви", "Общо нетекущи пасиви",                                 "общо_нетекущи_пасиви"),
    ("Пасиви", "Банкови заеми",                                        "банкови_заеми"),
    ("Пасиви", "Задължения по лизинг (краткосрочни)",                  "лизинг_задължения_краткосрочни"),
    ("Пасиви", "Търговски задължения",                                 "търговски_задължения"),
    ("Пасиви", "Задължения към персонала и осигуряването",             "задължения_персонал_осигуряване"),
    ("Пасиви", "Други задължения",                                     "други_задължения"),
    ("Пасиви", "Общо текущи пасиви",                                   "общо_текущи_пасиви"),
    ("Пасиви", "ОБЩО ПАСИВИ",                                          "общо_пасиви"),
    # Баланс — собствен капитал
    ("Собствен капитал", "Регистриран акционерен капитал",             "регистриран_акционерен_капитал"),
    ("Собствен капитал", "Неразпределена печалба",                     "неразпределена_печалба"),
    ("Собствен капитал", "Законови резерви",                           "законови_резерви"),
    ("Собствен капитал", "Премиен резерв",                             "премиен_резерв"),
    ("Собствен капитал", "Валутно-курсови разлики",                    "валутно_курсови_разлики"),
    ("Собствен капитал", "ОБЩО СОБСТВЕН КАПИТАЛ",                      "общо_собствен_капитал"),
    # Парични потоци
    ("Парични потоци", "Постъпления от клиенти",                       "постъпления_от_клиенти"),
    ("Парични потоци", "Плащания към доставчици",                      "плащания_към_доставчици"),
    ("Парични потоци", "Данъци възстановени/(платени), нето",          "данъци_възстановени_платени"),
    ("Парични потоци", "Плащания към персонал и осигуряване",          "плащания_персонал_осигуряване"),
    ("Парични потоци", "Нетни парични потоци от оперативна дейност",   "нетни_потоци_оперативна"),
    ("Парични потоци", "Капиталови разходи (CAPEX)",                   "капекс"),
    ("Парични потоци", "Нетни парични потоци от инвестиционна дейност","нетни_потоци_инвестиционна"),
    ("Парични потоци", "Изплатени дивиденти",                          "изплатени_дивиденти"),
    ("Парични потоци", "Нетни парични потоци от финансова дейност",    "нетни_потоци_финансова"),
    ("Парични потоци", "Пари в началото на периода",                   "пари_в_началото"),
    ("Парични потоци", "Пари в края на периода",                       "пари_в_края"),
]


# ── Помощни функции ───────────────────────────────────────────────────────────

def col(year, q):
    """Генерира заглавие на колона: 'Q1 2025 (3М)'"""
    return f"Q{q} {year} ({QUARTER_SUFFIX[q]})"


def discover_years(company_dir):
    """
    Открива автоматично наличните години от extract_qX_YYYY.py файлове
    в директорията на компанията. Не е нужен ръчен ALL_YEARS списък.
    """
    pattern = os.path.join(company_dir, "extract_q*_*.py")
    years = set()
    for path in glob.glob(pattern):
        m = re.search(r"extract_q\d+_(\d{4})\.py$", path)
        if m:
            years.add(int(m.group(1)))
    return sorted(years)


def load_quarter(company_dir, year, q):
    """
    Зарежда extract_qQ_YYYY.py от директорията на компанията.
    При липсващ скрипт връща None.
    """
    module_name = f"extract_q{q}_{year}"
    # Добавяме company_dir в началото на sys.path временно
    if company_dir not in sys.path:
        sys.path.insert(0, company_dir)
    # Премахваме кеша ако модулът е зареждан преди (за различни компании)
    if module_name in sys.modules:
        del sys.modules[module_name]
    try:
        mod = importlib.import_module(module_name)
        return mod.get_data()
    except ModuleNotFoundError:
        return None


def get_dicts(data, year, q):
    """
    Извлича (is_dict, bs_dict, cf_dict) от заредените данни.
    Q4 скриптовете пакетират данните под ключ по година.
    """
    if data is None:
        return {}, {}, {}
    if str(year) in data:
        d = data[str(year)]
        return (
            d.get("income_statement", {}),
            d.get("balance_sheet", {}),
            d.get("cash_flows", {}),
        )
    return (
        data.get("income_statement", {}),
        data.get("balance_sheet", {}),
        data.get("cash_flows", {}),
    )


def src(dicts, key):
    for d in dicts:
        if key in d:
            return d[key]
    return None


# ── Строители на таблици ──────────────────────────────────────────────────────

def build_annual_rows(year_data, all_years):
    rows_out = []
    for section, label, key in ROWS:
        row = {"раздел": section, "счетоводен_ред": label}
        for year in all_years:
            q4_data = year_data.get(year, {}).get(4)
            dicts = get_dicts(q4_data, year, 4)
            row[str(year)] = src(dicts, key)
        rows_out.append(row)
    return rows_out


def build_quarterly_rows_for_year(year, year_quarters):
    rows_out = []
    for section, label, key in ROWS:
        row = {"раздел": section, "счетоводен_ред": label}
        for q in range(1, 5):
            data = year_quarters.get(q)
            dicts = get_dicts(data, year, q)
            row[col(year, q)] = src(dicts, key)
        rows_out.append(row)
    return rows_out


def build_all_quarters_rows(year_data, all_years):
    rows_out = []
    for section, label, key in ROWS:
        row = {"раздел": section, "счетоводен_ред": label}
        for year in all_years:
            for q in range(1, 5):
                data = year_data.get(year, {}).get(q)
                dicts = get_dicts(data, year, q)
                row[col(year, q)] = src(dicts, key)
        rows_out.append(row)
    return rows_out


# ── Запис на CSV ──────────────────────────────────────────────────────────────

def write_csv(filepath, rows, fieldnames):
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)
    print(f"  Записан: {filepath}")


# ── Главна логика ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    company = parse_args()

    base_dir     = os.path.dirname(os.path.abspath(__file__))
    company_dir  = os.path.join(base_dir, company)
    out_dir      = os.path.join(company_dir, "output")

    if not os.path.isdir(company_dir):
        print(f"Грешка: директорията '{company_dir}' не съществува.")
        sys.exit(1)

    print(f"\nКомпания: {company}")
    print(f"Директория: {company_dir}")

    # ── Засичане на наличните години ─────────────────────────────────────────
    all_years = discover_years(company_dir)
    if not all_years:
        print(f"Грешка: не са намерени extract_qX_YYYY.py файлове в '{company_dir}'.")
        sys.exit(1)
    print(f"Открити години: {all_years}\n")

    # ── Зареждане на данни ────────────────────────────────────────────────────
    year_data = {}
    for year in all_years:
        year_data[year] = {}
        for q in range(1, 5):
            data = load_quarter(company_dir, year, q)
            if data is not None:
                year_data[year][q] = data
                print(f"  Зареден: extract_q{q}_{year}.py")

    print()

    # ── 1. Годишна CSV ────────────────────────────────────────────────────────
    annual_rows = build_annual_rows(year_data, all_years)
    write_csv(
        os.path.join(out_dir, f"{company}_annual.csv"),
        annual_rows,
        ["раздел", "счетоводен_ред"] + [str(y) for y in all_years],
    )

    # ── 2. Тримесечни CSV по година ───────────────────────────────────────────
    for year in all_years:
        if not year_data.get(year):
            continue
        q_rows = build_quarterly_rows_for_year(year, year_data[year])
        write_csv(
            os.path.join(out_dir, f"{company}_quarterly_{year}.csv"),
            q_rows,
            ["раздел", "счетоводен_ред"] + [col(year, q) for q in range(1, 5)],
        )

    # ── 3. Обединена тримесечна CSV (всички години) ───────────────────────────
    all_q_cols = [col(year, q) for year in all_years for q in range(1, 5)]
    all_q_rows = build_all_quarters_rows(year_data, all_years)
    all_csv_path = os.path.join(out_dir, f"{company}_quarterly_all.csv")
    write_csv(
        all_csv_path,
        all_q_rows,
        ["раздел", "счетоводен_ред"] + all_q_cols,
    )

    # ── 4. Копиране в docs/companies/<company>/data.csv ───────────────────────
    docs_target = os.path.join(base_dir, "..", "docs", "companies", company, "data.csv")
    docs_target = os.path.normpath(docs_target)
    if os.path.isdir(os.path.dirname(docs_target)):
        shutil.copy2(all_csv_path, docs_target)
        print(f"  Копиран:  {docs_target}")
    else:
        print(f"  Пропуснато копиране — директорията не съществува: {os.path.dirname(docs_target)}")

    print(f"\nГотово.\n")
