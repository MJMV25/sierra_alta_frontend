// Presentación de cantidades, periodos y códigos del backend en español (Colombia). Solo formato:
// los cálculos los hace el backend y aquí nunca se recalculan.

export const METHOD_LABELS = {
  SIMPLE_MOVING_AVERAGE: 'Promedio móvil simple',
  WEIGHTED_MOVING_AVERAGE: 'Promedio móvil ponderado',
  EXPONENTIAL_SMOOTHING: 'Suavizamiento exponencial',
  TREND_ADJUSTED_EXPONENTIAL_SMOOTHING: 'Suavizamiento con tendencia (Holt)',
  LINEAR_REGRESSION: 'Regresión lineal',
};

/** Nombres cortos para encabezados de tablas angostas; el nombre completo va en `title`. */
export const METHOD_SHORT_LABELS = {
  SIMPLE_MOVING_AVERAGE: 'Prom. simple',
  WEIGHTED_MOVING_AVERAGE: 'Prom. ponderado',
  EXPONENTIAL_SMOOTHING: 'Suavizamiento',
  TREND_ADJUSTED_EXPONENTIAL_SMOOTHING: 'Holt',
  LINEAR_REGRESSION: 'Regresión',
};

/** Orden fijo de los métodos: también fija su color en el gráfico. */
export const METHOD_ORDER = Object.keys(METHOD_LABELS);

export const STATUS_LABELS = {
  CUMPLE: { label: 'Cumple', tone: 'ok', icon: '✓' },
  NO_CUMPLE: { label: 'No cumple', tone: 'danger', icon: '✕' },
  SIN_EVALUAR: { label: 'Sin evaluar', tone: 'off', icon: '–' },
  SIN_CRITERIO: { label: 'Sin criterio definido', tone: 'off', icon: '–' },
};

/** La empresa registra producción y la trata como demanda; la interfaz dice "producción" (ADR 07). */
export const MEASURE_LABELS = { PRODUCCION: 'Producción', DEMANDA: 'Demanda' };

const numberFormat = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 });
// Los parámetros se muestran completos: α = 0,0025 no puede verse como 0.
const parameterFormat = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 10 });
const monthFormat = new Intl.DateTimeFormat('es-CO', { month: 'short', year: 'numeric', timeZone: 'UTC' });
const dateTimeFormat = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' });

export function formatNumber(value) {
  return value === null || value === undefined ? '—' : numberFormat.format(Number(value));
}

/** `mapePercent` ya viene en porcentaje desde el backend. */
export function formatPercent(value) {
  return value === null || value === undefined ? 'No calculable' : `${numberFormat.format(Number(value))} %`;
}

/**
 * Series de los casos de prueba del Excel (Spokane, ACME): periodos numerados t = 1, 2, 3… como en el
 * Excel. El backend guarda cada t como un mes ficticio desde enero de 2000 (migración V7).
 */
export const TEST_PERIODICITY = 'PERIODO';

/** '2000-06' → 6 en una serie PERIODO. */
export function periodIndex(period) {
  const [year, month] = period.split('-').map(Number);
  return (year - 2000) * 12 + month;
}

/** '2026-09' → 'sept de 2026'; en una serie PERIODO, '2000-06' → 't = 6'. */
export function formatPeriod(period, periodicity) {
  if (!period) return '—';
  if (periodicity === TEST_PERIODICITY) return `t = ${periodIndex(period)}`;
  const [year, month] = period.split('-').map(Number);
  return monthFormat.format(new Date(Date.UTC(year, month - 1, 1)));
}

/** "mes"/"meses" o, en una serie PERIODO, "periodo"/"periodos". */
export function periodWord(count, periodicity) {
  if (periodicity === TEST_PERIODICITY) return count === 1 ? 'periodo' : 'periodos';
  return count === 1 ? 'mes' : 'meses';
}

/** Valor de la columna de periodo en CSV y Excel: el número t en una serie PERIODO, si no 'AAAA-MM'. */
export function periodCell(period, periodicity) {
  return periodicity === TEST_PERIODICITY ? periodIndex(period) : period;
}

/** "Mes" o "Periodo" para encabezados. */
export function periodHeader(periodicity) {
  return periodicity === TEST_PERIODICITY ? 'Periodo (t)' : 'Mes';
}

export function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateTimeFormat.format(date);
}

/** Parámetros de un método en una línea, p. ej. "n = 4" o "α = 0,3 · β = 0,1". */
export function formatParameters(method) {
  if (method.method === 'SIMPLE_MOVING_AVERAGE') return `n = ${method.periods}`;
  if (method.method === 'WEIGHTED_MOVING_AVERAGE') {
    return `pesos ${method.weights.map((weight) => parameterFormat.format(weight)).join(' · ')}`;
  }
  if (method.method === 'EXPONENTIAL_SMOOTHING') return `α = ${parameterFormat.format(method.alpha)}`;
  if (method.method === 'LINEAR_REGRESSION') return 'Sin parámetros (P = b·t + a)';
  return `α = ${parameterFormat.format(method.alpha)} · β = ${parameterFormat.format(method.beta)}`;
}
