// dineroChf добавлен для возврата нулевого церковного налога (расчёт перенесён в MyChurch.ts).
import {
  DineroChf,
  dineroChf,
  dineroRound,
  multiplyDineroPercent,
  dineroAddMany
} from '~/lib/utils/dinero';
import { getTaxFactors } from './provider';
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

  const taxesIncomeCanton = dineroRound(
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

  const taxesFortuneCanton = dineroRound(
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

  return {
    taxesIncomeCanton,
    taxesIncomeCity,
    taxesIncomeChurch,
    taxesFortuneCanton,
    taxesFortuneCity,
    taxesFortuneChurch
  };
};
