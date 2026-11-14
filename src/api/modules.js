import { http } from './http';

export async function listProducts() {
  const { data } = await http.get('/history/products');
  return data;
}

export async function getSeriesObservations(seriesId) {
  const { data } = await http.get(`/history/series/${seriesId}/observations`);
  return data;
}

/** Historial de cambios de la hoja para una serie, del más reciente al más antiguo. */
export async function getSeriesChanges(seriesId) {
  const { data } = await http.get(`/history/series/${seriesId}/changes`);
  return data;
}

/**
 * Guarda los cambios de la hoja: `series` = [{ seriesId, dataVersion, changes: [{ period, value }] }], con
 * `value` null para borrar el mes. Se guardan todas las series o ninguna.
 */
export async function saveSheet(series) {
  const { data } = await http.patch('/history/observations', { series });
  return data;
}

/**
 * Recalcula sin guardar. `actuals` opcional: datos de la hoja que aún no se guardan. `signal` cancela un
 * cálculo que ya no sirve porque el usuario siguió escribiendo.
 */
export async function previewForecast({ seriesId, from, to, methods, actuals }, signal) {
  const { data } = await http.post('/forecasts/preview', { seriesId, from, to, methods, actuals }, { signal });
  return data;
}

/** Últimas 50 ejecuciones; `seriesId` opcional. */
export async function listForecasts(seriesId) {
  const { data } = await http.get('/forecasts', { params: seriesId ? { seriesId } : undefined });
  return data;
}

export async function getForecast(id) {
  const { data } = await http.get(`/forecasts/${id}`);
  return data;
}

/**
 * Guarda una ejecución. `idempotencyKey` nueva por cada clic en "Guardar pronóstico": si la red reintenta, el
 * backend devuelve la ejecución original en lugar de crear otra.
 */
export async function executeForecast({ seriesId, from, to, methods }, idempotencyKey) {
  const { data } = await http.post('/forecasts', { seriesId, from, to, methods }, {
    headers: { 'Idempotency-Key': idempotencyKey },
  });
  return data;
}

export async function getExecutionIndicators(executionId) {
  const { data } = await http.get(`/indicators/executions/${executionId}`);
  return data;
}
