import { http } from './http';

export async function listProducts() {
  const { data } = await http.get('/history/products');
  return data;
}

export async function getSeriesObservations(seriesId) {
  const { data } = await http.get(`/history/series/${seriesId}/observations`);
  return data;
}

/** `observations`: [{ period: 'AAAA-MM', value }]. Todo el lote entra o se rechaza. */
export async function uploadSeriesObservations(seriesId, observations) {
  const { data } = await http.post(`/history/series/${seriesId}/observations`, { observations });
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
 * `idempotencyKey` nueva por cada clic en "Ejecutar": si la red reintenta, el backend devuelve la
 * ejecución original en lugar de crear otra.
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
