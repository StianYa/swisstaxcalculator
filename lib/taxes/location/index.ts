import { access, readFile } from 'fs/promises';
import path from 'path';
import { dataParsedBasePath } from '../constants';
import { TaxLocation } from '../typesClient';

const locationsByYearAndCity = new Map<number, Map<number, TaxLocation>>();

const locationsByYear = new Map<number, TaxLocation[]>();

const MIN_YEAR = 2000;

/**
 * Возвращает ближайший к текущему году год, для которого есть данные (locations.json).
 * Текущий год → текущий−1 → … пока не найдётся папка с данными.
 */
export const getNearestYearWithData = async (): Promise<number> => {
  const currentYear = new Date().getFullYear();
  const base = path.resolve(process.cwd(), dataParsedBasePath);
  for (let y = currentYear; y >= MIN_YEAR; y--) {
    const filePath = path.join(base, String(y), 'locations.json');
    try {
      await access(filePath);
      return y;
    } catch {
      continue;
    }
  }
  throw new Error(`No locations data found (checked ${MIN_YEAR}..${currentYear})`);
};

const loadLocationsIfRequired = async (year: number) => {
  if (locationsByYearAndCity.has(year)) return;

  const filePath = path.resolve(process.cwd(), dataParsedBasePath, String(year), 'locations.json');
  const locations: TaxLocation[] = JSON.parse((await readFile(filePath, 'utf-8')));

  const locationsByCity = new Map<number, TaxLocation>();
  locationsByYearAndCity.set(year, locationsByCity);

  locations.forEach((location) => {
    locationsByCity.set(location.BfsID, location);
  });

  locationsByYear.set(year, locations);
};

export const getCantonIdByCityId = async (cityId: number, year: number) => {
  await loadLocationsIfRequired(year);
  const location = locationsByYearAndCity.get(year)?.get(cityId);
  if (!location) throw new Error(`Location not found for ${cityId}, ${year}`);
  return location.CantonID;
};

/**
 * Возвращает список локаций. Если year не передан, используется ближайший к текущему году год с данными.
 */
export const getTaxLocations = async (year?: number): Promise<TaxLocation[] | undefined> => {
  const resolvedYear = year ?? (await getNearestYearWithData());
  await loadLocationsIfRequired(resolvedYear);
  return locationsByYear.get(resolvedYear);
};
