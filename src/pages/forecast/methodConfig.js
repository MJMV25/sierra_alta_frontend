// Parámetros de los métodos tal como se escriben en pantalla (texto, con coma decimal) y su traducción al
// contrato del backend. Las reglas (α y β entre 0 y 1, n entero, pesos que suman 1) las valida el backend;
// aquí solo se avisa antes de pedir el cálculo lo que ya se sabe que fallará.

import { METHOD_ORDER } from '../../format';

export const MAX_WEIGHTS = 12;

/** Margen para aceptar sumas como 0,3 + 0,2 + 0,2 + 0,2 + 0,1, que en binario no dan 1 exacto. */
const SUM_TOLERANCE = 1e-9;

/** Valores iniciales para una serie mensual de la empresa. */
export const INITIAL_CONFIG = {
  SIMPLE_MOVING_AVERAGE: { enabled: true, periods: '3' },
  WEIGHTED_MOVING_AVERAGE: { enabled: true, weights: ['0,5', '0,3', '0,2'] },
  EXPONENTIAL_SMOOTHING: { enabled: true, alpha: '0,3' },
  TREND_ADJUSTED_EXPONENTIAL_SMOOTHING: { enabled: true, alpha: '0,3', beta: '0,1' },
  LINEAR_REGRESSION: { enabled: true },
  // No compite por el mejor método (ajuste dentro de la muestra), pero se muestra como en el Excel.
  SEASONAL_MULTIPLICATIVE: { enabled: true, seasonLength: '12' },
};

/**
 * Parámetros de la hoja RESUMEN del Excel para los datos de ejemplo: con ellos la aplicación da los mismos
 * MAD y MAPE que el Excel.
 */
export const EXCEL_CONFIG = {
  'CASO-1-SPOKANE': {
    SIMPLE_MOVING_AVERAGE: { enabled: true, periods: '5' },
    WEIGHTED_MOVING_AVERAGE: { enabled: true, weights: ['0,3', '0,2', '0,2', '0,2', '0,1'] },
    EXPONENTIAL_SMOOTHING: { enabled: true, alpha: '0,05' },
    TREND_ADJUSTED_EXPONENTIAL_SMOOTHING: { enabled: true, alpha: '0,0025', beta: '0,99' },
    LINEAR_REGRESSION: { enabled: true },
    SEASONAL_MULTIPLICATIVE: { enabled: true, seasonLength: '5' },
  },
  'CASO-2-ACME': {
    SIMPLE_MOVING_AVERAGE: { enabled: true, periods: '4' },
    WEIGHTED_MOVING_AVERAGE: { enabled: true, weights: ['0,1', '0,2', '0,3', '0,4'] },
    EXPONENTIAL_SMOOTHING: { enabled: true, alpha: '0,6' },
    TREND_ADJUSTED_EXPONENTIAL_SMOOTHING: { enabled: true, alpha: '0,3', beta: '0,1' },
    LINEAR_REGRESSION: { enabled: true },
    SEASONAL_MULTIPLICATIVE: { enabled: true, seasonLength: '4' },
  },
};

export function initialConfigFor(productCode) {
  return EXCEL_CONFIG[productCode] ?? INITIAL_CONFIG;
}

/** "0,3" o "0.3" → 0.3; vacío o inválido → NaN (el backend responde el error del campo). */
export function parseDecimal(text) {
  const value = String(text).trim().replace(',', '.');
  return /^-?\d+(\.\d+)?$/.test(value) ? Number(value) : Number.NaN;
}

export function weightsSum(weights) {
  return weights.map(parseDecimal).reduce((total, w) => total + (Number.isNaN(w) ? 0 : w), 0);
}

export function enabledMethods(config) {
  return METHOD_ORDER.filter((method) => config[method].enabled);
}

export function toRequest(method, config) {
  if (method === 'SIMPLE_MOVING_AVERAGE') return { method, periods: parseDecimal(config.periods) };
  if (method === 'WEIGHTED_MOVING_AVERAGE') return { method, weights: config.weights.map(parseDecimal) };
  if (method === 'EXPONENTIAL_SMOOTHING') return { method, alpha: parseDecimal(config.alpha) };
  if (method === 'LINEAR_REGRESSION') return { method };
  if (method === 'SEASONAL_MULTIPLICATIVE') return { method, seasonLength: parseDecimal(config.seasonLength) };
  return { method, alpha: parseDecimal(config.alpha), beta: parseDecimal(config.beta) };
}

/**
 * Errores que se ven sin preguntarle al backend, con la clave `MÉTODO.campo`. El más importante: los pesos K
 * del ponderado deben sumar exactamente 1 (pedido de Industrial); si no, no se calcula.
 */
export function localErrors(config) {
  const errors = {};
  const chosen = enabledMethods(config);
  if (chosen.length === 0) errors.methods = 'Elija al menos un método.';
  chosen.forEach((method) => {
    const request = toRequest(method, config[method]);
    Object.entries(request).forEach(([field, value]) => {
      if (field === 'method') return;
      if (Array.isArray(value)) {
        value.forEach((item, i) => {
          if (Number.isNaN(item)) errors[`${method}.${field}[${i}]`] = 'Escriba un número, p. ej. 0,2.';
        });
      } else if (Number.isNaN(value)) {
        errors[`${method}.${field}`] = 'Escriba un número.';
      }
    });
    if (method === 'WEIGHTED_MOVING_AVERAGE') {
      const sum = weightsSum(config[method].weights);
      if (Math.abs(sum - 1) > SUM_TOLERANCE) {
        errors[`${method}.weights`] = `Los pesos K suman ${String(Math.round(sum * 1e6) / 1e6).replace('.', ',')}: deben sumar exactamente 1.`;
      }
    }
  });
  return errors;
}

/** `methods[1].alpha` → `EXPONENTIAL_SMOOTHING.alpha`, según el orden en que se enviaron los métodos. */
export function errorsByMethod(errors, chosen) {
  return errors.reduce((acc, { field, message }) => {
    const match = /^methods\[(\d+)\]\.?(.*)$/.exec(field ?? '');
    const key = match && chosen[Number(match[1])] ? `${chosen[Number(match[1])]}.${match[2] || 'method'}` : field;
    acc[key] = acc[key] ? `${acc[key]} ${message}` : message;
    return acc;
  }, {});
}

/** Mes siguiente en formato "AAAA-MM". */
export function nextPeriod(period) {
  const [year, month] = period.split('-').map(Number);
  return month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, '0')}`;
}

/** Meses "AAAA-MM" de `from` a `to`, ambos incluidos. */
export function monthsBetween(from, to) {
  const months = [];
  for (let month = from; month <= to; month = nextPeriod(month)) months.push(month);
  return months;
}
