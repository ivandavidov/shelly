"""
Валидационен скрипт за финансови данни — company-agnostic
==========================================================
Зарежда динамично всички налични extract_qX_YYYY.py скриптове за
дадена компания и прилага набор от счетоводни проверки.

Проверки:
  [BS1]  Нетекущи активи + Текущи активи = Общо активи
  [BS2]  Нетекущи пасиви + Текущи пасиви = Общо пасиви
  [BS3]  Общо пасиви + Собствен капитал = Общо активи  ← основно счетоводно уравнение
  [IS1]  Приходи + Себестойност = Брутна печалба
  [IS2]  Брутна печалба + Оперативни приходи/разходи = EBIT
  [IS3]  EBIT + Финансов резултат + Дял асоциирани = EBT
  [IS4]  EBT + Данъци = Нетна печалба от продължаващи дейности
  [IS5]  Нетна продълж. + Нетна преустановени = Нетна печалба (общо)
  [IS6]  Нетна печалба + OCI = Общо всеобхватен доход
  [CF1]  Оперативни + Инвестиционни + Финансови потоци = Нетна промяна на пари
  [CF2]  Пари в началото + Нетна промяна + Курсови разлики = Пари в края
  [CF3]  Пари в края (ПП) = Пари и парични еквиваленти (Баланс)

Допустима разлика: ±1 хил. лв. (закръгляване в отчетите)

Използване:
  python3 validate.py --company shelly
  python3 validate.py shelly            (positional)
"""

import argparse
import glob
import importlib
import os
import re
import sys


# ── CLI аргументи ─────────────────────────────────────────────────────────────

def parse_args():
    parser = argparse.ArgumentParser(
        description="Валидира финансовите данни на дадена компания."
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
            "Моля, посочете ID на компанията: python3 validate.py --company shelly"
        )
    return company


# ── Константи ─────────────────────────────────────────────────────────────────

TOLERANCE = 1  # хил. лв.

GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
RESET  = "\033[0m"
BOLD   = "\033[1m"


# ── Зареждане на данни ────────────────────────────────────────────────────────

def discover_years(company_dir):
    """Открива наличните години от extract_qX_YYYY.py файлове."""
    pattern = os.path.join(company_dir, "extract_q*_*.py")
    years = set()
    for path in glob.glob(pattern):
        m = re.search(r"extract_q\d+_(\d{4})\.py$", path)
        if m:
            years.add(int(m.group(1)))
    return sorted(years)


def load_quarter(company_dir, year, q):
    module_name = f"extract_q{q}_{year}"
    if company_dir not in sys.path:
        sys.path.insert(0, company_dir)
    if module_name in sys.modules:
        del sys.modules[module_name]
    try:
        mod = importlib.import_module(module_name)
        return mod.get_data()
    except ModuleNotFoundError:
        return None


def get_dicts(data, year):
    """Връща (is_dict, bs_dict, cf_dict) — поддържа Q4 и Q1–Q3 формати."""
    if data is None:
        return {}, {}, {}
    if str(year) in data:
        d = data[str(year)]
        return d.get("income_statement", {}), d.get("balance_sheet", {}), d.get("cash_flows", {})
    return data.get("income_statement", {}), data.get("balance_sheet", {}), data.get("cash_flows", {})


def v(d, *keys):
    """Връща първата намерена стойност от речника; None ако липсва."""
    for k in keys:
        if k in d:
            return d[k]
    return None


# ── Валидационен клас ─────────────────────────────────────────────────────────

class Validator:
    def __init__(self, period_label):
        self.period = period_label
        self.errors = []
        self.warnings = []
        self.passed = 0

    def check(self, code, description, lhs_label, lhs_val, rhs_label, rhs_val):
        if lhs_val is None or rhs_val is None:
            self.warnings.append(
                f"  [{code}] {description}: пропусната — липсва стойност "
                f"({'LHS' if lhs_val is None else 'RHS'})"
            )
            return
        diff = round(lhs_val - rhs_val, 2)
        if abs(diff) > TOLERANCE:
            self.errors.append(
                f"  [{code}] {description}\n"
                f"         {lhs_label} = {lhs_val:>12,.0f}\n"
                f"         {rhs_label} = {rhs_val:>12,.0f}\n"
                f"         Разлика    = {diff:>+12,.0f}  ← ГРЕШКА"
            )
        else:
            self.passed += 1

    def report(self):
        total = self.passed + len(self.errors)
        status = f"{GREEN}ОК{RESET}" if not self.errors else f"{RED}ГРЕШКИ{RESET}"
        print(f"\n{BOLD}{'─'*60}{RESET}")
        print(f"{BOLD}{self.period}{RESET}  [{status}]  "
              f"{self.passed}/{total} проверки преминати")
        if self.warnings:
            for w in self.warnings:
                print(f"{YELLOW}{w}{RESET}")
        if self.errors:
            for e in self.errors:
                print(f"{RED}{e}{RESET}")


# ── Проверки ──────────────────────────────────────────────────────────────────

def validate_balance_sheet(v_obj, bs):
    if not bs:
        return

    nc_assets    = v(bs, "общо_нетекущи_активи")
    curr_assets  = v(bs, "общо_текущи_активи")
    hfs_assets   = v(bs, "активи_държани_за_продажба") or 0
    total_assets = v(bs, "общо_активи")

    nc_liab   = v(bs, "общо_нетекущи_пасиви")
    curr_liab = v(bs, "общо_текущи_пасиви")
    hfs_liab  = v(bs, "пасиви_ържани_за_продажба") or 0
    total_liab = v(bs, "общо_пасиви")

    equity = v(bs, "общо_собствен_капитал")

    if nc_assets is not None and curr_assets is not None:
        v_obj.check(
            "BS1", "Нетекущи активи + Текущи активи (+ HFS) = Общо активи",
            "НА + ТА + HFS (изчислено)", nc_assets + curr_assets + hfs_assets,
            "Общо активи (отчетено)", total_assets,
        )

    if nc_liab is not None and curr_liab is not None:
        v_obj.check(
            "BS2", "Нетекущи пасиви + Текущи пасиви (+ HFS) = Общо пасиви",
            "НП + ТП + HFS (изчислено)", nc_liab + curr_liab + hfs_liab,
            "Общо пасиви (отчетено)", total_liab,
        )

    if total_liab is not None and equity is not None:
        v_obj.check(
            "BS3", "Общо пасиви + Собствен капитал = Общо активи",
            "Пасиви + Капитал (изчислено)", total_liab + equity,
            "Общо активи (отчетено)", total_assets,
        )


def validate_income_statement(v_obj, is_):
    if not is_:
        return

    rev  = v(is_, "приходи_от_продажби")
    cogs = v(is_, "себестойност_на_продажбите")
    gp   = v(is_, "брутна_печалба")

    other_inc  = v(is_, "други_приходи_от_дейността")
    sell_exp   = v(is_, "разходи_за_продажби")
    admin_exp  = v(is_, "административни_разходи")
    other_exp  = v(is_, "други_разходи_за_дейността")
    ebit       = v(is_, "печалба_от_оперативна_дейност_ebit")

    fin_inc    = v(is_, "финансови_приходи") or 0
    fin_exp    = v(is_, "финансови_разходи") or 0
    assoc      = v(is_, "дял_асоциирани_дружества") or 0
    ebt        = v(is_, "печалба_преди_данъци_ebt")

    tax        = v(is_, "разход_за_данъци") or 0
    net_cont   = v(is_, "нетна_печалба_продължаващи")
    net_discont = v(is_, "печалба_преустановени_дейности") or 0
    net_total  = v(is_, "нетна_печалба")

    oci        = v(is_, "общо_oci") or 0
    total_ci   = v(is_, "общо_всеобхватен_доход")

    if rev is not None and cogs is not None:
        v_obj.check(
            "IS1", "Приходи + Себестойност = Брутна печалба",
            "Изчислена брутна печалба", rev + cogs,
            "Отчетена брутна печалба", gp,
        )

    impairment = v(is_, "разходи_за_обезценка") or 0
    op_items_present = any(x is not None for x in [other_inc, sell_exp, admin_exp, other_exp])
    if gp is not None and ebit is not None and op_items_present:
        calc_ebit = gp + (other_inc or 0) + (sell_exp or 0) + (admin_exp or 0) + (other_exp or 0) + impairment
        v_obj.check(
            "IS2", "Брутна печалба + оперативни корекции = EBIT",
            "Изчислен EBIT", calc_ebit,
            "Отчетен EBIT", ebit,
        )
    elif gp is not None and ebit is not None and not op_items_present:
        v_obj.warnings.append(
            "  [IS2] Брутна печалба → EBIT: пропусната — липсват детайлни оперативни редове"
        )

    if ebit is not None and ebt is not None:
        v_obj.check(
            "IS3", "EBIT + Финансов резултат + Асоциирани = EBT",
            "Изчислен EBT", ebit + fin_inc + fin_exp + assoc,
            "Отчетен EBT", ebt,
        )

    if ebt is not None:
        calc = ebt + tax
        match_cont  = net_cont  is not None and abs(calc - net_cont)  <= TOLERANCE
        match_total = net_total is not None and abs(calc - net_total) <= TOLERANCE
        if match_cont or match_total:
            v_obj.passed += 1
            if match_total and not match_cont and abs(net_discont) > TOLERANCE:
                v_obj.warnings.append(
                    f"  [IS4] EBT+данък съвпада с нетна общо (не с продълж.) — "
                    f"EBT изглежда включва преустановените дейности ({net_discont:+,.0f})"
                )
        else:
            target = net_cont if net_cont is not None else net_total
            label  = "нетна (продълж.)" if net_cont is not None else "нетна (общо)"
            diff   = round(calc - target, 2) if target is not None else None
            v_obj.errors.append(
                f"  [IS4] EBT + Данъци = Нетна печалба\n"
                f"         EBT + данък (изчислено)  = {calc:>12,.0f}\n"
                f"         {label} (отчетено) = {target:>12,.0f}\n"
                f"         Разлика                  = {diff:>+12,.0f}  ← ГРЕШКА"
            )

    if net_cont is not None and net_total is not None:
        v_obj.check(
            "IS5", "Нетна (продълж.) + Нетна (преустановени) = Нетна печалба общо",
            "Изчислена нетна (продълж. + преуст.)", net_cont + net_discont,
            "Отчетена нетна печалба", net_total,
        )

    if net_total is not None and total_ci is not None:
        v_obj.check(
            "IS6", "Нетна печалба + OCI = Общо всеобхватен доход",
            "Изчислен общо всеобхватен доход", net_total + oci,
            "Отчетен общо всеобхватен доход", total_ci,
        )


def validate_cash_flows(v_obj, cf, bs):
    if not cf:
        return

    op  = v(cf, "нетни_потоци_оперативна")
    inv = v(cf, "нетни_потоци_инвестиционна")
    fin = v(cf, "нетни_потоци_финансова")
    net_change = v(cf, "нетна_промяна_пари")
    fx         = v(cf, "нетни_курсови_разлики_пари") or 0
    opening    = v(cf, "пари_в_началото")
    closing_cf = v(cf, "пари_в_края")

    if op is not None and inv is not None and fin is not None and net_change is not None:
        v_obj.check(
            "CF1", "Оперативни + Инвестиционни + Финансови потоци = Нетна промяна на пари",
            "Изчислена нетна промяна", op + inv + fin,
            "Отчетена нетна промяна", net_change,
        )

    hfs_cash = v(cf, "пари_прехвърлени_към_hfs") or 0
    if opening is not None and net_change is not None and closing_cf is not None:
        v_obj.check(
            "CF2", "Пари в началото + Нетна промяна + Курсови (+ HFS) = Пари в края",
            "Изчислени пари в края", opening + net_change + fx + hfs_cash,
            "Отчетени пари в края (ПП)", closing_cf,
        )

    if closing_cf is not None and bs:
        cash_bs = v(bs, "пари_и_парични_еквиваленти")
        if cash_bs is not None:
            v_obj.check(
                "CF3", "Пари в края (ПП) = Пари и пар. еквиваленти (Баланс)",
                "Пари в края (ПП)",  closing_cf,
                "Пари (Баланс)",     cash_bs,
            )


# ── Главна логика ─────────────────────────────────────────────────────────────

def run(company, company_dir, all_years):
    total_errors = 0
    total_checked = 0
    periods_found = 0

    for year in all_years:
        for q in range(1, 5):
            raw = load_quarter(company_dir, year, q)
            if raw is None:
                continue

            years_in_file = [year]
            if str(year - 1) in raw:
                years_in_file.append(year - 1)

            for y in years_in_file:
                is_, bs, cf = get_dicts(raw, y)
                if not is_ and not bs and not cf:
                    continue

                if y == year:
                    label = raw.get("meta", {}).get("период", f"Q{q} {year}")
                else:
                    label = f"FY {y} (сравнителна в Q{q} {year} отчет)"

                periods_found += 1
                val = Validator(label)
                validate_balance_sheet(val, bs)
                validate_income_statement(val, is_)
                validate_cash_flows(val, cf, bs)
                val.report()

                total_errors += len(val.errors)
                total_checked += val.passed + len(val.errors)

    print(f"\n{'═'*60}")
    print(f"{BOLD}ОБОБЩЕНИЕ — {company}{RESET}")
    print(f"  Периоди проверени : {periods_found}")
    print(f"  Проверки общо     : {total_checked}")
    if total_errors == 0:
        print(f"  {GREEN}{BOLD}Всички проверки преминати успешно.{RESET}")
    else:
        print(f"  {RED}{BOLD}Открити несъответствия: {total_errors}{RESET}")
    print(f"{'═'*60}\n")

    return total_errors


if __name__ == "__main__":
    company = parse_args()

    base_dir    = os.path.dirname(os.path.abspath(__file__))
    company_dir = os.path.join(base_dir, company)

    if not os.path.isdir(company_dir):
        print(f"Грешка: директорията '{company_dir}' не съществува.")
        sys.exit(1)

    all_years = discover_years(company_dir)
    if not all_years:
        print(f"Грешка: не са намерени extract_qX_YYYY.py файлове в '{company_dir}'.")
        sys.exit(1)

    print(f"\nВалидация: {company}  |  Години: {all_years}\n")
    errors = run(company, company_dir, all_years)
    sys.exit(1 if errors else 0)
