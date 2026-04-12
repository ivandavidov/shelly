"""
Шелли Груп — Валидационен скрипт за финансови данни
=====================================================
Зарежда динамично всички налични extract_qX_YYYY.py скриптове и
прилага набор от счетоводни проверки върху всеки наличен период.

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

Използване: python3 validate.py
"""

import importlib
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

ALL_YEARS = [2021, 2022, 2023, 2024, 2025]
TOLERANCE = 1  # хил. лв.

# ── Цветове за терминал ───────────────────────────────────────────────────────
GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
RESET  = "\033[0m"
BOLD   = "\033[1m"


# ── Зареждане на данни ────────────────────────────────────────────────────────

def load_quarter(year, q):
    try:
        mod = importlib.import_module(f"extract_q{q}_{year}")
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
        """Сравнява lhs и rhs; регистрира грешка при разлика > TOLERANCE."""
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

    def sum_if_present(self, d, *keys):
        """Сумира всички намерени ключове; None ако нито един не е намерен."""
        vals = [d[k] for k in keys if k in d]
        return sum(vals) if vals else None

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
    hfs_assets   = v(bs, "активи_държани_за_продажба") or 0   # HFS — отделна балансова позиция
    total_assets = v(bs, "общо_активи")

    nc_liab   = v(bs, "общо_нетекущи_пасиви")
    curr_liab = v(bs, "общо_текущи_пасиви")
    hfs_liab  = v(bs, "пасиви_държани_за_продажба") or 0      # HFS — отделна балансова позиция
    total_liab = v(bs, "общо_пасиви")

    equity = v(bs, "общо_собствен_капитал")

    # [BS1] Нетекущи + Текущи активи (+ HFS активи) = Общо активи
    if nc_assets is not None and curr_assets is not None:
        v_obj.check(
            "BS1", "Нетекущи активи + Текущи активи (+ HFS) = Общо активи",
            "НА + ТА + HFS (изчислено)", nc_assets + curr_assets + hfs_assets,
            "Общо активи (отчетено)", total_assets,
        )

    # [BS2] Нетекущи + Текущи пасиви (+ HFS пасиви) = Общо пасиви
    if nc_liab is not None and curr_liab is not None:
        v_obj.check(
            "BS2", "Нетекущи пасиви + Текущи пасиви (+ HFS) = Общо пасиви",
            "НП + ТП + HFS (изчислено)", nc_liab + curr_liab + hfs_liab,
            "Общо пасиви (отчетено)", total_liab,
        )

    # [BS3] Пасиви + Капитал = Активи (основно счетоводно уравнение)
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

    # [IS1] Приходи + COGS = Брутна печалба
    if rev is not None and cogs is not None:
        v_obj.check(
            "IS1", "Приходи + Себестойност = Брутна печалба",
            "Изчислена брутна печалба", rev + cogs,
            "Отчетена брутна печалба", gp,
        )

    # [IS2] Брутна печалба + оперативни приходи/разходи = EBIT
    # Пропуска се ако нито един оперативен ред не е наличен (непълни сравнителни данни)
    op_items_present = any(x is not None for x in [other_inc, sell_exp, admin_exp, other_exp])
    if gp is not None and ebit is not None and op_items_present:
        calc_ebit = gp + (other_inc or 0) + (sell_exp or 0) + (admin_exp or 0) + (other_exp or 0)
        v_obj.check(
            "IS2", "Брутна печалба + оперативни корекции = EBIT",
            "Изчислен EBIT", calc_ebit,
            "Отчетен EBIT", ebit,
        )
    elif gp is not None and ebit is not None and not op_items_present:
        v_obj.warnings.append(
            "  [IS2] Брутна печалба → EBIT: пропусната — липсват детайлни оперативни редове "
            "(непълни данни за периода)"
        )

    # [IS3] EBIT + финансов резултат + асоциирани = EBT
    if ebit is not None and ebt is not None:
        v_obj.check(
            "IS3", "EBIT + Финансов резултат + Асоциирани = EBT",
            "Изчислен EBT", ebit + fin_inc + fin_exp + assoc,
            "Отчетен EBT", ebt,
        )

    # [IS4] EBT + Данъци = Нетна печалба
    # Стандартна МСФО презентация: EBT е само от продължаващи дейности → EBT+данък = нетна продълж.
    # Но понякога (малки discontinued суми) EBT включва и discontinued → EBT+данък = нетна общо.
    # Приемаме и двата случая; ако нито един не минава — грешка.
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

    # [IS5] Продължаващи + Преустановени = Нетна печалба общо
    if net_cont is not None and net_total is not None:
        v_obj.check(
            "IS5", "Нетна (продълж.) + Нетна (преустановени) = Нетна печалба общо",
            "Изчислена нетна (продълж. + преуст.)", net_cont + net_discont,
            "Отчетена нетна печалба", net_total,
        )

    # [IS6] Нетна печалба + OCI = Общо всеобхватен доход
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

    # [CF1] Оп + Инв + Фин = Нетна промяна
    if op is not None and inv is not None and fin is not None and net_change is not None:
        v_obj.check(
            "CF1", "Оперативни + Инвестиционни + Финансови потоци = Нетна промяна на пари",
            "Изчислена нетна промяна", op + inv + fin,
            "Отчетена нетна промяна", net_change,
        )

    # [CF2] Начало + Нетна промяна + Курсови (+ HFS преклас.) = Край
    # Някои периоди съдържат пари, прекласифицирани към "държани за продажба" (HFS).
    hfs_cash = v(cf, "пари_прехвърлени_към_hfs") or 0
    if opening is not None and net_change is not None and closing_cf is not None:
        v_obj.check(
            "CF2", "Пари в началото + Нетна промяна + Курсови (+ HFS) = Пари в края",
            "Изчислени пари в края", opening + net_change + fx + hfs_cash,
            "Отчетени пари в края (ПП)", closing_cf,
        )

    # [CF3] Пари в края (ПП) = Пари и парични еквиваленти (Баланс)
    if closing_cf is not None and bs:
        cash_bs = v(bs, "пари_и_парични_еквиваленти")
        if cash_bs is not None:
            v_obj.check(
                "CF3", "Пари в края (ПП) = Пари и пар. еквиваленти (Баланс)",
                "Пари в края (ПП)",      closing_cf,
                "Пари (Баланс)",          cash_bs,
            )


# ── Главна логика ─────────────────────────────────────────────────────────────

def run():
    total_errors = 0
    total_checked = 0
    periods_found = 0

    for year in ALL_YEARS:
        for q in range(1, 5):
            raw = load_quarter(year, q)
            if raw is None:
                continue

            # Q4 скриптовете могат да съдържат и данни за предходната година
            years_in_file = [year]
            if str(year - 1) in raw:
                years_in_file.append(year - 1)

            for y in years_in_file:
                is_, bs, cf = get_dicts(raw, y)
                if not is_ and not bs and not cf:
                    continue

                # Период — по-кратък за Q1–Q3, пълен за Q4/годишни
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

    # Обобщение
    print(f"\n{'═'*60}")
    print(f"{BOLD}ОБОБЩЕНИЕ{RESET}")
    print(f"  Периоди проверени : {periods_found}")
    print(f"  Проверки общо     : {total_checked}")
    if total_errors == 0:
        print(f"  {GREEN}{BOLD}Всички проверки преминати успешно.{RESET}")
    else:
        print(f"  {RED}{BOLD}Открити несъответствия: {total_errors}{RESET}")
    print(f"{'═'*60}\n")

    return total_errors


if __name__ == "__main__":
    errors = run()
    sys.exit(1 if errors else 0)
