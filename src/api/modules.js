import { http } from './http';

export async function listProducts() {
  const { data } = await http.get('/history/products');
  return data;
}

export async function getSeriesObservations(seriesId) {
  const { data } = await http.get(`/history/series/${seriesId}/observations`);
  return data;
}

export async function uploadSeriesObservations(seriesId, payload) {
  const { data } = await http.post(`/history/series/${seriesId}/observations`, payload);
  return data;
}

export async function listForecasts() {
  const { data } = await http.get('/forecasts');
  return data;
}

export async function getForecast(id) {
  const { data } = await http.get(`/forecasts/${id}`);
  return data;
}

export async function executeForecast(payload) {
  const { data } = await http.post('/forecasts', payload);
  return data;
}

export async function getExecutionIndicators(executionId) {
  const { data } = await http.get(`/indicators/executions/${executionId}`);
  return data;
}
