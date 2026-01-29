import { getTaxLocations } from '~~/lib/taxes/location';

/**
 * GET /api/locations
 * Возвращает список локаций (городов) для ближайшего к текущему году года, по которому есть данные.
 * Текущий год → текущий−1 → … (например, в 2026 при наличии только 2025 берётся 2025).
 */
export default defineEventHandler(async () => {
  const locations = await getTaxLocations();
  return locations;
});
