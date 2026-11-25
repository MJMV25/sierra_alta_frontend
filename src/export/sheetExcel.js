// Hoja de datos en Excel, de ida y vuelta (pedido de Industrial, ADR 13 del backend): se exporta con el mismo
// formato de la hoja DATOS del Excel del proyecto (un bloque por año, REFERENCIA + ENERO…DICIEMBRE + TOTALES),
// se edita en Excel y se vuelve a cargar. La lectura reconoce ese formato venga de la aplicación o del Excel
// original de Industrial. ExcelJS se carga solo al exportar o importar.

import { MONTH_NAMES } from '../format';

const TITLE = 'UNIDADES PRODUCIDAS DE LAS REFERENCIAS DE PRODUCTOS SELECCIONADOS';
const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7D0F22' } };
const TITLE_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4E3E6' } };

/** Sin tildes, en mayúsculas y solo letras y números: "T-Shirt Running " → "TSHIRTRUNNING". */
export function normalizeName(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

const MONTH_KEYS = MONTH_NAMES.map(normalizeName);

/** Mes (1-12) de un encabezado: "ENERO", "Enero", "ene" o "Sept". */
function monthOf(text) {
  const key = normalizeName(text);
  if (key.length < 3) return null;
  const index = MONTH_KEYS.findIndex((month) => month === key || month.startsWith(key));
  return index === -1 ? null : index + 1;
}

/**
 * Libro con la hoja DATOS. `series`: [{ label, stored: Map periodo → valor }] en el orden de la pantalla.
 */
export async function buildSheetWorkbook(series) {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sierra Alta';
  workbook.created = new Date();
  const sheet = workbook.addWorksheet('DATOS', { views: [{ showGridLines: false }] });
  sheet.columns = [{ width: 24 }, ...MONTH_NAMES.map(() => ({ width: 11 })), { width: 12 }];

  sheet.addRow(['DATOS HISTÓRICOS DE LA PRODUCCIÓN · SIERRA ALTA']).font = { bold: true, size: 14 };
  sheet.addRow([
    'Corrija o agregue meses y vuelva a cargar este archivo con "Importar Excel". Una celda vacía no cambia nada; '
      + 'si no hubo producción, escriba 0. No cambie los nombres de las referencias ni de los meses.',
  ]).font = { italic: true, color: { argb: 'FF555555' } };
  sheet.addRow([]);

  const periods = series.flatMap((s) => [...s.stored.keys()]).sort();
  if (periods.length === 0) return workbook;
  const firstYear = Number(periods[0].slice(0, 4));
  const lastYear = Number(periods[periods.length - 1].slice(0, 4));
  for (let year = firstYear; year <= lastYear; year += 1) {
    const title = sheet.addRow([`${TITLE} ${year}`]);
    sheet.mergeCells(title.number, 1, title.number, 14);
    title.font = { bold: true };
    title.getCell(1).fill = TITLE_FILL;
    title.getCell(1).alignment = { horizontal: 'center' };

    const header = sheet.addRow(['REFERENCIA', ...MONTH_NAMES.map((m) => m.toUpperCase()), 'TOTALES']);
    header.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = HEADER_FILL;
      cell.alignment = { horizontal: 'center' };
    });
    series.forEach((s) => {
      const values = MONTH_NAMES.map((_, i) => s.stored.get(`${year}-${String(i + 1).padStart(2, '0')}`) ?? null);
      const row = sheet.addRow([s.label.toUpperCase(), ...values]);
      const first = row.getCell(2).address;
      const last = row.getCell(13).address;
      row.getCell(14).value = { formula: `SUM(${first}:${last})`, result: values.reduce((t, v) => t + (v ?? 0), 0) };
      row.getCell(14).font = { bold: true };
    });
    sheet.addRow([]);
  }
  return workbook;
}

/** Descarga el libro como Blob .xlsx. */
export async function workbookBlob(workbook) {
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/**
 * Lee un libro con bloques "REFERENCIA + meses" y su año en el título de arriba. `references`: [{ seriesId,
 * name, code }] de la empresa, que se reconocen por nombre o código sin importar tildes, espacios ni
 * mayúsculas. Devuelve { values: [{ seriesId, period, value }], unknown: [nombres], errors: [mensajes] }.
 * Las celdas vacías se ignoran (no borran meses).
 */
export async function readSheetWorkbook(buffer, references) {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch {
    return { values: [], unknown: [], errors: ['El archivo no es un libro de Excel (.xlsx) válido.'] };
  }
  const byName = new Map();
  references.forEach((ref) => {
    byName.set(normalizeName(ref.name), ref.seriesId);
    byName.set(normalizeName(ref.code), ref.seriesId);
  });

  const values = new Map();
  const unknown = new Set();
  const errors = [];
  workbook.eachSheet((sheet) => {
    let year = null;
    let block = null;
    sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      const cells = [];
      row.eachCell({ includeEmpty: false }, (cell, col) => cells.push({ col, value: plain(cell.value) }));
      const texts = cells.filter((c) => typeof c.value === 'string');
      const referenceCell = texts.find((c) => normalizeName(c.value) === 'REFERENCIA');
      if (referenceCell) {
        const months = cells
          .filter((c) => c.col > referenceCell.col && typeof c.value === 'string' && monthOf(c.value))
          .map((c) => ({ col: c.col, month: monthOf(c.value) }));
        block = months.length > 0 && year ? { refCol: referenceCell.col, months, year } : null;
        if (months.length > 0 && !year) {
          errors.push(`Hoja ${sheet.name}, fila ${rowNumber}: no se encontró el año del bloque (debe estar en el título de arriba).`);
        }
        return;
      }
      const yearText = texts.map((c) => /\b(19|20)\d{2}\b/.exec(c.value)?.[0]).find(Boolean);
      if (yearText && !texts.some((c) => byName.has(normalizeName(c.value)))) {
        year = Number(yearText);
        block = null;
        return;
      }
      if (!block) return;
      const nameCell = cells.find((c) => c.col === block.refCol);
      if (!nameCell || typeof nameCell.value !== 'string' || nameCell.value.trim() === '') {
        block = cells.length === 0 ? null : block;
        return;
      }
      const seriesId = byName.get(normalizeName(nameCell.value));
      if (seriesId === undefined) {
        unknown.add(nameCell.value.trim());
        return;
      }
      block.months.forEach(({ col, month }) => {
        const raw = cells.find((c) => c.col === col)?.value;
        if (raw === undefined || raw === null || (typeof raw === 'string' && raw.trim() === '')) return;
        const period = `${block.year}-${String(month).padStart(2, '0')}`;
        const value = cellNumber(raw);
        if (value === null) {
          errors.push(`${nameCell.value.trim()}, ${MONTH_NAMES[month - 1].toLowerCase()} de ${block.year}: "${raw}" no es una cantidad entera.`);
          return;
        }
        values.set(`${seriesId}|${period}`, { seriesId, period, value });
      });
    });
  });
  return { values: [...values.values()], unknown: [...unknown], errors };
}

/** Valor de una celda de ExcelJS sin envoltorios: resultado de fórmula, texto enriquecido, etc. */
function plain(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'object') return value;
  if ('result' in value) return value.result ?? null;
  if ('richText' in value) return value.richText.map((part) => part.text).join('');
  if ('text' in value) return value.text;
  return null;
}

/** Entero ≥ 0; un guion es 0 (respuesta 14 de Industrial). Cualquier otra cosa: null. */
function cellNumber(raw) {
  if (typeof raw === 'number') return Number.isInteger(raw) && raw >= 0 ? raw : null;
  const text = String(raw).trim();
  if (/^[-–—]$/.test(text)) return 0;
  return /^\d+$/.test(text) ? Number(text) : null;
}
