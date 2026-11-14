import { describe, expect, it } from 'vitest';
import { buildSheetWorkbook, normalizeName, readSheetWorkbook } from '../export/sheetExcel';
import { localErrors, INITIAL_CONFIG } from '../pages/forecast/methodConfig';
import { changesFor, parseCell, summarize, visiblePeriods, yearBlocks } from '../pages/workspace/sheetModel';

const stored = new Map([
  ['2026-05', 10],
  ['2026-06', 20],
]);

describe('Celdas de la hoja', () => {
  it('acepta enteros, separador de miles y el guion del Excel como 0', () => {
    expect(parseCell('120')).toEqual({ value: 120 });
    expect(parseCell(' 1.234 ')).toEqual({ value: 1234 });
    expect(parseCell('7,0')).toEqual({ value: 7 });
    expect(parseCell('-')).toEqual({ value: 0 });
    expect(parseCell('')).toEqual({ empty: true, value: null });
    expect(parseCell('12,5').error).toMatch(/enteras/);
    expect(parseCell('abc').error).toBeDefined();
  });

  it('compara el borrador con lo guardado: nuevo, corregido, borrado o sin cambio', () => {
    const { changes, invalid } = changesFor(stored, { '2026-05': '10', '2026-06': '', '2026-07': '30', '2026-08': 'x', '2026-09': '' });
    expect(changes).toEqual([
      { period: '2026-06', value: null },
      { period: '2026-07', value: 30 },
    ]);
    expect(invalid).toEqual(['2026-08']);

    const summary = summarize([{ seriesId: 1, dataVersion: 5, stored }], { 1: { '2026-05': '11', '2026-07': '30' } });
    expect(summary).toMatchObject({ added: 1, corrected: 1, removed: 0, invalid: 0 });
    expect(summary.series).toEqual([{ seriesId: 1, dataVersion: 5, changes: [{ period: '2026-05', value: 11 }, { period: '2026-07', value: 30 }] }]);
  });

  it('muestra años completos desde el primer mes con datos', () => {
    const periods = visiblePeriods([{ seriesId: 1, stored }], { 1: { '2027-01': '5' } }, 0, '2026-11');
    expect(periods[0]).toBe('2026-05');
    expect(periods.at(-1)).toBe('2027-01');
    const blocks = yearBlocks(periods);
    expect(blocks.map((b) => b.year)).toEqual([2026, 2027]);
    expect(blocks[0].months[0]).toBeNull();
    expect(blocks[0].months[4]).toBe('2026-05');
    expect(visiblePeriods([{ seriesId: 1, stored: new Map() }], {}, 0, '2026-11')).toEqual([]);
  });

  it('los pesos K deben sumar exactamente 1 antes de pedir el cálculo', () => {
    expect(localErrors(INITIAL_CONFIG)).toEqual({});
    const wrong = { ...INITIAL_CONFIG, WEIGHTED_MOVING_AVERAGE: { enabled: true, weights: ['0,5', '0,4'] } };
    expect(localErrors(wrong)['WEIGHTED_MOVING_AVERAGE.weights']).toMatch(/suman 0,9/);
    const spokane = { ...INITIAL_CONFIG, WEIGHTED_MOVING_AVERAGE: { enabled: true, weights: ['0,3', '0,2', '0,2', '0,2', '0,1'] } };
    expect(localErrors(spokane)).toEqual({});
    const text = { ...INITIAL_CONFIG, EXPONENTIAL_SMOOTHING: { enabled: true, alpha: 'a' } };
    expect(localErrors(text)['EXPONENTIAL_SMOOTHING.alpha']).toBeDefined();
  });
});

describe('Excel de ida y vuelta', () => {
  const references = [
    { seriesId: 1, name: 'Jersey Pro', code: 'JERSEY-PRO' },
    { seriesId: 2, name: 'T-Shirt Running', code: 'T-SHIRT-RUNNING' },
  ];

  it('reconoce nombres sin importar tildes, espacios ni mayúsculas', () => {
    expect(normalizeName('T-SHIRT RUNNING ')).toBe(normalizeName('T-Shirt Running'));
  });

  it('lo que se exporta se vuelve a leer igual', async () => {
    const workbook = await buildSheetWorkbook([
      { label: 'Jersey Pro', stored: new Map([['2025-12', 16], ['2026-01', 18]]) },
      { label: 'T-Shirt Running', stored: new Map([['2026-01', 2028]]) },
    ]);
    const buffer = await workbook.xlsx.writeBuffer();
    const result = await readSheetWorkbook(buffer, references);
    expect(result.errors).toEqual([]);
    expect(result.unknown).toEqual([]);
    expect(result.values).toEqual(
      expect.arrayContaining([
        { seriesId: 1, period: '2025-12', value: 16 },
        { seriesId: 1, period: '2026-01', value: 18 },
        { seriesId: 2, period: '2026-01', value: 2028 },
      ]),
    );
    expect(result.values).toHaveLength(3);
  });

  it('lee la hoja DATOS de Industrial: año en el título, guion como 0 y avisa lo desconocido', async () => {
    const { default: ExcelJS } = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('DATOS');
    sheet.getCell('K3').value = 'UNIDADES PRODUCIDAS DE LAS REFERENCIAS DE PRODUCTOS SELECCIONADOS 2024 ';
    ['REFERENCIA', 'ENERO', 'FEBRERO', 'MARZO', 'TOTALES'].forEach((text, i) => {
      sheet.getCell(4, 11 + i).value = text;
    });
    sheet.getRow(5).getCell(11).value = 'JERSEY PRO ';
    sheet.getRow(5).getCell(12).value = 85;
    sheet.getRow(5).getCell(13).value = '-';
    sheet.getRow(5).getCell(14).value = 12.5;
    sheet.getRow(5).getCell(15).value = { formula: 'SUM(L5:N5)', result: 97.5 };
    sheet.getRow(6).getCell(11).value = 'PANTALONETA NUEVA';
    sheet.getRow(6).getCell(12).value = 3;
    // Datos de Spokane en las mismas filas, a la izquierda, sin encabezado REFERENCIA: se ignoran.
    sheet.getRow(5).getCell(2).value = 1;
    sheet.getRow(5).getCell(3).value = 275;

    const result = await readSheetWorkbook(await workbook.xlsx.writeBuffer(), references);
    expect(result.values).toEqual([
      { seriesId: 1, period: '2024-01', value: 85 },
      { seriesId: 1, period: '2024-02', value: 0 },
    ]);
    expect(result.unknown).toEqual(['PANTALONETA NUEVA']);
    expect(result.errors[0]).toMatch(/JERSEY PRO, marzo de 2024: "12.5" no es una cantidad entera/);
  });

  it('un archivo que no es Excel se informa sin romper', async () => {
    const result = await readSheetWorkbook(new TextEncoder().encode('hola').buffer, references);
    expect(result.errors[0]).toMatch(/no es un libro de Excel/);
  });
});
