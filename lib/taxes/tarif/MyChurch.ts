/**
 * Расчёт церковного налога (Kirchensteuer) строго по плану церковный_налог_по_кантонам_estv.
 * База и особые правила по кантонам: UR (формула), BL (по конфессии), BS/TI/JU (кантон), VS (община),
 * NE (кантон + 10 CHF), GE (einfache + мин. 10 CHF).
 */
import {
  DineroChf,
  dineroChf,
  dineroRound,
  multiplyDineroPercent,
  dineroAddMany,
  dineroMax
} from '~/lib/utils/dinero';
import { getChurchIncomeFactor, getChurchFortuneFactor } from '../factor';
import { TaxFactors } from '../factor/types';
import { TaxInput, TaxConfession } from '../typesClient';

/** Все базы, нужные для выбора правильной базы церковного налога по кантону (доход и имущество). */
export interface ChurchTaxBases {
  taxesIncomeBase: DineroChf;
  taxesIncomeCanton: DineroChf;
  taxesIncomeCity: DineroChf;
  taxesFortuneBase: DineroChf;
  taxesFortuneCanton: DineroChf;
  taxesFortuneCity: DineroChf;
  taxableIncomeCanton: DineroChf;
  taxableFortuneCanton: DineroChf;
}

/**
 * UR (22) по плану: база = 1% Einkommen + 0.3‰ Vermögen + 30 CHF; затем % от этой базы.
 * Возвращает эту комбинированную базу (для дохода; результат церкви по UR кладём только в taxesIncomeChurch).
 */
function getURCompositeBase(bases: ChurchTaxBases): DineroChf {
  const part1 = multiplyDineroPercent(bases.taxableIncomeCanton, 1, 2);
  const part2 = multiplyDineroPercent(bases.taxableFortuneCanton, 0.3, 2); // 0.3‰ = 0.03%
  const part3 = dineroChf(30);
  return dineroAddMany(part1, part2, part3);
}

/**
 * База для церковного налога по доходу (план: таблица + «Кратко по кантонам с ошибкой»).
 * BL (5): по конфессии — christ/protestant → steuerbares Einkommen, roman → geschuldete Kantonssteuer.
 * confession передаётся только для BL; для остальных не используется.
 */
function getIncomeChurchBase(
  cantonId: number,
  bases: ChurchTaxBases,
  confession?: TaxConfession
): DineroChf {
  switch (cantonId) {
    case 22: // UR — база комбинированная, считается отдельно в MyCalculateChurchTax
      return getURCompositeBase(bases);
    case 5: // BL: по конфессии
      if (confession === 'christ' || confession === 'protestant')
        return bases.taxableIncomeCanton;
      if (confession === 'roman') return bases.taxesIncomeCanton;
      return dineroChf(0);
    case 6: // BS — geschuldeter Kantonssteuerbetrag
    case 21: // TI
    case 11: // JU
    case 13: // NE — Kantonssteuerbetrag (+ 10 CHF потом)
      return bases.taxesIncomeCanton;
    case 24: // VS — Gemeindesteuer
      return bases.taxesIncomeCity;
    case 8: // GE — einfache Kantonssteuer + Minimalsteuer 10 CHF
      return bases.taxesIncomeBase;
    default:
      return bases.taxesIncomeBase;
  }
}

/**
 * База для церковного налога по имуществу (план: та же логика по кантонам).
 */
function getFortuneChurchBase(
  cantonId: number,
  bases: ChurchTaxBases,
  confession?: TaxConfession
): DineroChf {
  switch (cantonId) {
    case 22: // UR — комбинированная база (уже учтена в income для UR)
      return dineroChf(0);
    case 5: // BL: по конфессии
      if (confession === 'christ' || confession === 'protestant')
        return bases.taxableFortuneCanton;
      if (confession === 'roman') return bases.taxesFortuneCanton;
      return dineroChf(0);
    case 6: // BS
    case 21: // TI
    case 11: // JU
    case 13: // NE
      return bases.taxesFortuneCanton;
    case 24: // VS
      return bases.taxesFortuneCity;
    case 8: // GE
      return bases.taxesFortuneBase;
    default:
      return bases.taxesFortuneBase;
  }
}

/**
 * Рассчитывает церковный налог по доходу и по имуществу строго по плану.
 * BL: база разная по конфессии, считаем по каждому лицу отдельно (без деления на n).
 * UR: одна комбинированная база, результат только в taxesIncomeChurch.
 * NE: +10 CHF (Grundtaxe). GE: минимум 10 CHF.
 */
export function MyCalculateChurchTax(
  taxInput: TaxInput,
  bases: ChurchTaxBases,
  factor: TaxFactors
): { taxesIncomeChurch: DineroChf; taxesFortuneChurch: DineroChf } {
  const { cantonId } = taxInput;
  const isBL = cantonId === 5;
  const isUR = cantonId === 22;

  let taxesIncomeChurch: DineroChf;
  let taxesFortuneChurch: DineroChf;

  if (isUR) {
    // UR: база = 1% Einkommen + 0.3‰ Vermögen + 30; результат только в income church (план).
    const urBase = getURCompositeBase(bases);
    taxesIncomeChurch = dineroRound(
      dineroAddMany(
        ...taxInput.persons.map((person) =>
          multiplyDineroPercent(
            urBase,
            getChurchIncomeFactor(person.confession, factor) / taxInput.persons.length,
            2
          )
        )
      )
    );
    taxesFortuneChurch = dineroChf(0);
  } else if (isBL) {
    // BL: по конфессии своя база на каждого; без деления на n (каждый платит со своей базы).
    taxesIncomeChurch = dineroRound(
      dineroAddMany(
        ...taxInput.persons.map((person) =>
          multiplyDineroPercent(
            getIncomeChurchBase(cantonId, bases, person.confession),
            getChurchIncomeFactor(person.confession, factor),
            2
          )
        )
      )
    );
    taxesFortuneChurch = dineroRound(
      dineroAddMany(
        ...taxInput.persons.map((person) =>
          multiplyDineroPercent(
            getFortuneChurchBase(cantonId, bases, person.confession),
            getChurchFortuneFactor(person.confession, factor),
            5
          )
        )
      )
    );
  } else {
    // Остальные кантоны: одна база на всех, доля по лицам (деление на n).
    const incomeBase = getIncomeChurchBase(cantonId, bases);
    const fortuneBase = getFortuneChurchBase(cantonId, bases);
    taxesIncomeChurch = dineroRound(
      dineroAddMany(
        ...taxInput.persons.map((person) =>
          multiplyDineroPercent(
            incomeBase,
            getChurchIncomeFactor(person.confession, factor) / taxInput.persons.length,
            2
          )
        )
      )
    );
    taxesFortuneChurch = dineroRound(
      dineroAddMany(
        ...taxInput.persons.map((person) =>
          multiplyDineroPercent(
            fortuneBase,
            getChurchFortuneFactor(person.confession, factor) / taxInput.persons.length,
            5
          )
        )
      )
    );
  }

  // NE (13): Grundtaxe +10 CHF по доходу (план).
  if (cantonId === 13) {
    taxesIncomeChurch = dineroAddMany(taxesIncomeChurch, dineroChf(10));
  }

  // GE (8): Minimalsteuer 10 CHF (план).
  if (cantonId === 8) {
    taxesIncomeChurch = dineroMax(taxesIncomeChurch, dineroChf(10));
    taxesFortuneChurch = dineroMax(taxesFortuneChurch, dineroChf(10));
  }

  return { taxesIncomeChurch, taxesFortuneChurch };
}
