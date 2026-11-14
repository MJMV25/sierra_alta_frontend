// Modelo de la hoja de datos: valores guardados, lo que el usuario escribió sin guardar ("borrador") y lo que
// resulta de combinar ambos. Solo organiza datos; las reglas finales (sin huecos, solo borrar el último mes,
// no meses futuros) las valida el backend al guardar (ADR 13).

import { monthsBetween, nextPeriod } from '../forecast/methodConfig';

/** Lo que el usuario escribió en una celda → número entero, vacío (borrar) o error. */
export function parseCell(text) {
  const raw = String(text ?? '').trim().replace(/\s/g, '');
  if (raw === '') return { empty: true, value: null };
  // Un guion del Excel es 0 unidades (respuesta 14 de Industrial).
  if (/^[-–—]$/.test(raw)) return { value: 0 };
  // "1.234" o "1,234" con separador de miles; las unidades son enteras.
  if (/^\d{1,3}([.,]\d{3})+$/.test(raw)) return { value: Number(raw.replace(/[.,]/g, '')) };
  if (/^\d+$/.test(raw)) return { value: Number(raw) };
  if (/^\d+[.,]0+$/.test(raw)) return { value: Number(raw.split(/[.,]/)[0]) };
  return { error: 'Escriba unidades enteras (0 si no hubo producción).' };
}

/** Valores guardados de una serie como Map periodo → número. */
export function storedValues(observations) {
  return new Map(observations.map((o) => [o.period, Number(o.value)]));
}

/**
 * Cambios efectivos del borrador de una serie frente a lo guardado. `invalid` lista los meses con texto que
 * no es un número válido (no se envían). Una celda vacía en un mes que no existía no es un cambio.
 */
export function changesFor(stored, draft = {}) {
  const changes = [];
  const invalid = [];
  Object.entries(draft).forEach(([period, text]) => {
    const parsed = parseCell(text);
    if (parsed.error) {
      invalid.push(period);
      return;
    }
    const before = stored.get(period);
    if (parsed.empty) {
      if (before !== undefined) changes.push({ period, value: null });
    } else if (before !== parsed.value) {
      changes.push({ period, value: parsed.value });
    }
  });
  changes.sort((a, b) => a.period.localeCompare(b.period));
  return { changes, invalid: invalid.sort() };
}

/** Valores con el borrador aplicado (los inválidos conservan el valor guardado). */
export function effectiveValues(stored, draft = {}) {
  const values = new Map(stored);
  changesFor(stored, draft).changes.forEach(({ period, value }) => {
    if (value === null) values.delete(period);
    else values.set(period, value);
  });
  return values;
}

/** Serie ordenada [{ period, value }] para pedir un recálculo con datos sin guardar. */
export function actualsOf(values) {
  return [...values.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, value]) => ({ period, value }));
}

/** Cuenta los cambios de todo el borrador: meses nuevos, corregidos y borrados, y celdas con error. */
export function summarize(seriesList, drafts) {
  const summary = { added: 0, corrected: 0, removed: 0, invalid: 0, series: [] };
  seriesList.forEach((series) => {
    const { changes, invalid } = changesFor(series.stored, drafts[series.seriesId]);
    summary.invalid += invalid.length;
    if (changes.length === 0) return;
    summary.series.push({ seriesId: series.seriesId, dataVersion: series.dataVersion, changes });
    changes.forEach(({ period, value }) => {
      if (value === null) summary.removed += 1;
      else if (series.stored.has(period)) summary.corrected += 1;
      else summary.added += 1;
    });
  });
  return summary;
}

/**
 * Meses que muestra la hoja: desde el primero con datos hasta el último (guardado o escrito), más los meses
 * agregados con "+ Mes". Sin datos, arranca en enero del año de `fallbackFrom`.
 */
export function visiblePeriods(seriesList, drafts, extraMonths, fallbackFrom) {
  const known = seriesList.flatMap((series) => [
    ...series.stored.keys(),
    ...Object.entries(drafts[series.seriesId] ?? {})
      .filter(([, text]) => !parseCell(text).empty)
      .map(([period]) => period),
  ]);
  if (known.length === 0 && extraMonths === 0) return [];
  const sorted = known.sort();
  const first = sorted[0] ?? `${fallbackFrom.slice(0, 4)}-01`;
  let last = sorted[sorted.length - 1] ?? first;
  for (let i = 0; i < extraMonths; i += 1) last = nextPeriod(last);
  return monthsBetween(first, last);
}

/** Bloques de 12 periodos (un año, o t = 1–12, 13–24… en los datos de ejemplo), siempre completos. */
export function yearBlocks(periods) {
  if (periods.length === 0) return [];
  const firstYear = Number(periods[0].slice(0, 4));
  const lastYear = Number(periods[periods.length - 1].slice(0, 4));
  const shown = new Set(periods);
  const blocks = [];
  for (let year = firstYear; year <= lastYear; year += 1) {
    const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
    blocks.push({ year, months: months.map((period) => (shown.has(period) ? period : null)), all: months });
  }
  return blocks;
}

/** Mes en curso "AAAA-MM" en la zona de la empresa. */
export function currentMonth(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit' })
    .formatToParts(now);
  const part = (type) => parts.find((p) => p.type === type).value;
  return `${part('year')}-${part('month')}`;
}
