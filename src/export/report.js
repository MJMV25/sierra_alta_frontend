// Contenido de las exportaciones (respuesta 23 de Industrial, ADR 07): datos reales y pronosticados,
// periodo, referencia, método, parámetros, indicadores y rango de evaluación, gráfico, fecha y hora de
// cálculo, usuario, versión de datos y advertencias. Solo reorganiza lo que ya calculó el backend.

import {
  formatDateTime,
  formatParameters,
  formatPercent,
  formatPeriod,
  MEASURE_LABELS,
  METHOD_LABELS,
  STATUS_LABELS,
} from '../format';

/** Meses con real más el mes pronosticado; cada método trae null donde no tiene pronóstico. */
export function forecastTable(detail) {
  const next = detail.methods[0]?.nextForecast?.period;
  const periods = [...detail.actuals.map((a) => a.period), ...(next ? [next] : [])];
  const actualOf = new Map(detail.actuals.map((a) => [a.period, Number(a.value)]));
  const forecastsOf = (method) => {
    const byPeriod = new Map(
      [...method.forecasts, method.nextForecast].filter(Boolean).map((p) => [p.period, Number(p.forecast)]),
    );
    return periods.map((period) => byPeriod.get(period) ?? null);
  };
  const evaluated = (period) =>
    Boolean(detail.evaluationStart) && period >= detail.evaluationStart && actualOf.has(period);
  return {
    periods,
    actuals: periods.map((period) => actualOf.get(period) ?? null),
    methods: detail.methods.map((method) => ({ method: method.method, values: forecastsOf(method) })),
    evaluated: periods.map(evaluated),
    isNext: periods.map((period) => !actualOf.has(period)),
  };
}

/** Advertencias en texto: meses con real 0 fuera del MAPE e indicadores no calculables. */
export function warnings(detail, comparison) {
  const notes = [];
  detail.methods.forEach((method) => {
    const name = METHOD_LABELS[method.method] ?? method.method;
    if (method.mad === null) notes.push(`${name}: MAD y MAPE no calculables (ningún mes evaluado).`);
    else if (method.mapePercent === null) notes.push(`${name}: MAPE no calculable (todos los reales evaluados son 0).`);
    if (method.mapeExcluded > 0) {
      notes.push(`${name}: ${method.mapeExcluded} ${method.mapeExcluded === 1 ? 'mes' : 'meses'} con producción 0 fuera del MAPE (sí en el MAD).`);
    }
  });
  if (comparison?.mapeThresholdPercent === null) {
    notes.push('Ejecución anterior al umbral de aceptación: sin criterio definido.');
  }
  return notes;
}

/** Ficha de la ejecución: pares [etiqueta, valor] en texto. */
export function summaryRows(detail, comparison) {
  const measure = MEASURE_LABELS[detail.measure] ?? detail.measure ?? 'Producción';
  return [
    ['Ejecución', `n.º ${detail.id}`],
    ['Referencia', [detail.productCode, detail.productName].filter(Boolean).join(' · ')],
    ['Medida', `${measure} (${detail.unit})`],
    ['Periodo histórico', `${formatPeriod(detail.periodFrom)} a ${formatPeriod(detail.periodTo)} (${detail.actuals.length} meses)`],
    ['Mes pronosticado', formatPeriod(detail.methods[0]?.nextForecast?.period)],
    [
      'Rango de evaluación',
      comparison?.evaluationFrom
        ? `${formatPeriod(comparison.evaluationFrom)} a ${formatPeriod(comparison.evaluationTo)}`
        : 'Sin meses evaluados',
    ],
    [
      'Umbral de aceptación',
      comparison?.mapeThresholdPercent === null || comparison?.mapeThresholdPercent === undefined
        ? 'Sin criterio definido'
        : `MAPE menor que ${formatPercent(comparison.mapeThresholdPercent)}`,
    ],
    ['Fecha y hora de cálculo', formatDateTime(detail.executedAt)],
    ['Ejecutado por', detail.executedByUsername ?? `usuario n.º ${detail.executedBy}`],
    ['Versión de datos', String(detail.dataVersion)],
    ['Versión de cálculo', detail.calculationVersion],
  ];
}

/** Una fila por método con sus parámetros, pronóstico siguiente e indicadores. */
export function methodRows(detail, comparison) {
  const rowOf = (code) => comparison?.methods.find((row) => row.method === code);
  return detail.methods.map((method) => {
    const row = rowOf(method.method);
    return {
      method: METHOD_LABELS[method.method] ?? method.method,
      parameters: formatParameters(method),
      next: method.nextForecast ? Number(method.nextForecast.forecast) : null,
      mad: method.mad === null ? null : Number(method.mad),
      mapePercent: method.mapePercent === null ? null : Number(method.mapePercent),
      pairsUsed: method.pairsUsed,
      bestByMad: Boolean(row?.bestByMad),
      bestByMape: Boolean(row?.bestByMape),
      status: row ? (STATUS_LABELS[row.status]?.label ?? row.status) : '',
    };
  });
}

/** CSV con separador ";" y coma decimal, como lo abre Excel en español; con BOM para las tildes. */
export function tableCsv(detail) {
  const table = forecastTable(detail);
  const number = (value) => (value === null || value === undefined ? '' : String(value).replace('.', ','));
  const header = ['Mes', `Real (${detail.unit})`, ...table.methods.map((m) => METHOD_LABELS[m.method] ?? m.method), 'Entra al MAD y MAPE'];
  const lines = table.periods.map((period, i) => [
    period,
    number(table.actuals[i]),
    ...table.methods.map((m) => number(m.values[i])),
    table.isNext[i] ? 'Mes pronosticado' : table.evaluated[i] ? 'Sí' : 'No',
  ]);
  return `﻿${[header, ...lines].map((cells) => cells.map(csvCell).join(';')).join('\r\n')}\r\n`;
}

function csvCell(value) {
  const text = String(value);
  return /[;"\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** Nombre de archivo sin tildes ni espacios: "pronostico-12-jersey-pro". */
export function fileBaseName(detail) {
  const slug = (detail.productName ?? 'serie')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `pronostico-${detail.id}-${slug}`;
}

/** Descarga un Blob con el nombre dado. */
export function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
