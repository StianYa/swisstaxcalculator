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
 * Ступень: первая строка table с row.amount >= income; при отсутствии — последняя строка.
 * Пустая формула → 0. Иначе: замена "log $wert$" на "Math.log($wert$)", подстановка дохода, безопасное вычисление.
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

  // Выбор ступени: первая строка, где row.amount >= income; иначе последняя строка.
  let row = table[table.length - 1];
  for (let i = 0; i < table.length; i++) {
    if (table[i].amount >= income) {
      row = table[i];
      break;
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

  return dineroChf(Math.round(result));
}
