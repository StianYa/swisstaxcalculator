/**
 * Расчёт налога по тарифу типа FORMEL (формула из данных).
 * Используется для кантона BL (Basel-Landschaft) и других кантонов с tableType FORMEL.
 * Данные за 2022–2025: таблица с полем formula ($wert$, log $wert$) и порогами amount.
 */
import { Dinero } from 'dinero.js';
import { dineroChf, dineroToNumber, DineroChf } from '~/lib/utils/dinero';
import { TaxTarif } from './types';

/**
 * Вычисляет налог по тарифу FORMEL: выбор ступени по amount, подстановка $wert$ в формулу, вычисление.
 * Ступень: последняя строка table с row.amount <= income (эталон BL).
 * Пустая формула → 0. Иначе: замена "log $wert$" на "Math.log($wert$)", подстановка дохода, безопасное вычисление.
 * Округление: результат формулы один раз округляется до 5 Rappen (0.05 CHF) здесь; дальнейшее округление до целых франков — в factor/index (dineroRound, halfEven).
 */
export function MyCalculateTaxesByTypeFormel(
  amount: Dinero<number>,
  tarif: TaxTarif
): DineroChf {
  const income = dineroToNumber(amount);

  // Отрицательный доход: не подставлять в Math.log; возвращаем 0.
  if (income < 0) {
    return dineroChf(0);
  }

  const table = tarif.table;
  if (!table.length) {
    return dineroChf(0);
  }

  // Выбор ступени: последняя строка, где row.amount <= income (эталон BL: Birsfelden 90'026 → ступень 44'577 → 9'572 CHF).
  // Ранее было «первая строка, где amount >= income» — давало ступень 111'442 и ~9'500 вместо 9'572.
  let row = table[0];
  for (let i = 0; i < table.length; i++) {
    if (table[i].amount <= income) {
      row = table[i];
    }
  }

  const formula = row.formula?.trim() ?? '';
  if (formula === '') {
    return dineroChf(0);
  }

  // Подстановка: "log $wert$" → "Math.log($wert$)", затем "$wert$" → значение дохода.
  const wertStr = String(income);
  let expr = formula.replace(/log \$wert\$/g, 'Math.log($wert$)').replace(/\$wert\$/g, wertStr);

  // Безопасность: только допустимые символы (числа, операции, скобки, Math.log).
  if (!/^[\d.eE\s+\-*/(),Mathlog]+$/.test(expr)) {
    return dineroChf(0);
  }

  let result: number;
  try {
    result = new Function('return ' + expr)();
  } catch {
    return dineroChf(0);
  }

  if (typeof result !== 'number' || !Number.isFinite(result)) {
    return dineroChf(0);
  }

  // Округление по правилу «5 Rappen» (0.05 CHF): до ближайших 5 сантимов; 0.025 округляется вверх.
  // CH AL 5RAP / Swiss payroll and tax: round to nearest 0.05 CHF.
  // Момент: один раз сразу после формулы, до возврата; факторы (100%, 62%) и округление до целых франков — в factor/index (dineroRound).
  const rounded005 = Math.round(result / 0.05) * 0.05;
  const rounded005Clean = Math.round(rounded005 * 100) / 100; // убрать артефакты float (9572.050000000001)
  return dineroChf(rounded005Clean);
}
