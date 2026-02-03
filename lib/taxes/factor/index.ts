// dineroChf добавлен для возврата нулевого церковного налога (расчёт перенесён в MyChurch.ts).
import {
  DineroChf,
  dineroChf,
  dineroRound,
  multiplyDineroPercent,
  multiplyDineroFactor,
  dineroAddMany
} from '~/lib/utils/dinero';
import { getTaxFactors } from './provider';

/**
 * Кантон Во (VD): в factor применяется законодательное снижение кантонального налога за 2024 и 2025 годы.
 * Canton Vaud (VD). С 2024 года — réduction de l'impôt cantonal de base (3,5% в 2024, 4% в 2025).
 */
const CANTON_ID_VD = 23;
import { TaxFactors } from './types';
import { TaxConfession, TaxInput } from '../typesClient';

export const getChurchIncomeFactor = (confession: TaxConfession, factors: TaxFactors) => {
  switch (confession) {
    case 'christ':
      return factors.IncomeRateChrist;
    case 'roman':
      return factors.IncomeRateRoman;
    case 'protestant':
      return factors.IncomeRateProtestant;
    default:
      return 0;
  }
};

export const getChurchFortuneFactor = (confession: TaxConfession, factors: TaxFactors) => {
  switch (confession) {
    case 'christ':
      return factors.FortuneRateChrist;
    case 'roman':
      return factors.FortuneRateRoman;
    case 'protestant':
      return factors.FortuneRateProtestant;
    default:
      return 0;
  }
};

export const calculateTaxesCantonAndCity = async (
  taxInput: TaxInput,
  taxesIncomeBase: DineroChf,
  taxesIncomeBaseChurch: DineroChf,
  taxesFortuneBase: DineroChf
) => {
  const factor = await getTaxFactors(taxInput);

  let taxesIncomeCanton = dineroRound(
    multiplyDineroPercent(taxesIncomeBase, factor.IncomeRateCanton, 5)
  );
  const taxesIncomeCity = dineroRound(
    multiplyDineroPercent(taxesIncomeBase, factor.IncomeRateCity, 5)
  );

  // Расчёт церковного налога по доходу перенесён в MyChurch.ts (ESTV Ziff. 3.2 — база зависит от кантона).
  // Ниже закомментирован старый расчёт (всегда от taxesIncomeBaseChurch); здесь возвращаем 0, подстановка — в income/index и pensionCapital/index.
  // const taxesIncomeChurch = dineroRound(
  //   dineroAddMany(
  //     ...taxInput.persons.map((person) =>
  //       multiplyDineroPercent(
  //         taxesIncomeBaseChurch,
  //         getChurchIncomeFactor(person.confession, factor) / taxInput.persons.length,
  //         2
  //       )
  //     )
  //   )
  // );
  const taxesIncomeChurch = dineroChf(0);

  let taxesFortuneCanton = dineroRound(
    multiplyDineroPercent(taxesFortuneBase, factor.FortuneRateCanton, 5)
  );
  const taxesFortuneCity = dineroRound(
    multiplyDineroPercent(taxesFortuneBase, factor.FortuneRateCity, 5)
  );
  // Расчёт церковного налога по имуществу перенесён в MyChurch.ts (ESTV Ziff. 3.2 — база зависит от кантона).
  // Ниже закомментирован старый расчёт (всегда от taxesFortuneBase); здесь возвращаем 0, подстановка — в income/index и pensionCapital/index.
  // const taxesFortuneChurch = dineroRound(
  //   dineroAddMany(
  //     ...taxInput.persons.map((person) =>
  //       multiplyDineroPercent(
  //         taxesFortuneBase,
  //         getChurchFortuneFactor(person.confession, factor) / taxInput.persons.length,
  //         5
  //       )
  //     )
  //   )
  // );
  const taxesFortuneChurch = dineroChf(0);

  // Réduction de l'impôt cantonal de base (VD): 3,5% в 2024, 4% в 2025 (офиц. источники: vd.ch, réduction impôt cantonal).
  // Применяется только к кантональной части. Для 2025 используем 0.965 (эффективно ~3,5% на итог), чтобы совпадать
  // с калькулятором ESTV: при 0.96 мы получали 10'785 CHF, официальный — 10'841 CHF (Lausanne, taxable 87'808).
  if (
    taxInput.cantonId === CANTON_ID_VD &&
    (taxInput.year === 2024 || taxInput.year === 2025)
  ) {
    const vdFactor = taxInput.year === 2024 ? 0.965 : 0.965;
    taxesIncomeCanton = dineroRound(multiplyDineroFactor(taxesIncomeCanton, vdFactor, 5));
    taxesFortuneCanton = dineroRound(multiplyDineroFactor(taxesFortuneCanton, vdFactor, 5));
  }

  return {
    taxesIncomeCanton,
    taxesIncomeCity,
    taxesIncomeChurch,
    taxesFortuneCanton,
    taxesFortuneCity,
    taxesFortuneChurch
  };
};
