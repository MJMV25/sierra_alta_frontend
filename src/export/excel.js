// Libro de Excel de una ejecución: hoja "Resumen" (ficha, comparación, advertencias y gráfico) y hoja
// "Datos" (real y pronóstico de cada método por mes). ExcelJS se carga solo al exportar.

import { METHOD_LABELS, periodCell, periodHeader } from '../format';
import { forecastTable, methodRows, summaryRows, warnings } from './report';

const NUMBER = '#,##0.00';
const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F5F7' } };
const EVALUATED_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF4FF' } };
const NEXT_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFAEB' } };

/** `chartPng`: Blob PNG del gráfico (opcional) con su tamaño en píxeles { blob, width, height }. */
export async function buildWorkbook(detail, comparison, chartPng = null) {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sierra Alta';
  workbook.created = new Date();

  const summary = workbook.addWorksheet('Resumen', { views: [{ showGridLines: false }] });
  summary.columns = [{ width: 30 }, { width: 26 }, { width: 18 }, { width: 14 }, { width: 12 }, { width: 12 }, { width: 18 }];
  summary.addRow([`Pronóstico n.º ${detail.id}: ${detail.productName ?? ''}`]).font = { bold: true, size: 14 };
  summary.addRow([]);
  summaryRows(detail, comparison).forEach(([label, value]) => {
    const row = summary.addRow([label, value]);
    row.getCell(1).font = { bold: true };
  });

  summary.addRow([]);
  summary.addRow(['Comparación de métodos']).font = { bold: true, size: 12 };
  const header = summary.addRow([
    'Método',
    'Parámetros',
    'Pronóstico siguiente',
    `MAD (${detail.unit})`,
    'MAPE (%)',
    'Periodos evaluados',
    'Estado',
  ]);
  styleHeader(header);
  methodRows(detail, comparison).forEach((method) => {
    const row = summary.addRow([
      method.method,
      method.parameters,
      method.next,
      method.mad ?? 'No calculable',
      method.mapePercent ?? 'No calculable',
      method.pairsUsed,
      [method.status, method.bestByMad && 'menor MAD', method.bestByMape && 'menor MAPE'].filter(Boolean).join(' · '),
    ]);
    [3, 4, 5].forEach((cell) => {
      row.getCell(cell).numFmt = NUMBER;
    });
  });

  const notes = warnings(detail, comparison);
  if (notes.length > 0) {
    summary.addRow([]);
    summary.addRow(['Advertencias']).font = { bold: true, size: 12 };
    notes.forEach((note) => summary.addRow([note]));
  }

  if (chartPng) {
    summary.addRow([]);
    const top = summary.rowCount;
    const imageId = workbook.addImage({ buffer: await chartPng.blob.arrayBuffer(), extension: 'png' });
    const width = 760;
    summary.addImage(imageId, {
      tl: { col: 0, row: top },
      ext: { width, height: Math.round((width * chartPng.height) / chartPng.width) },
    });
  }

  const data = workbook.addWorksheet('Datos', { views: [{ state: 'frozen', ySplit: 1, xSplit: 1 }] });
  const table = forecastTable(detail);
  data.columns = [
    { header: periodHeader(detail.periodicity), width: 12 },
    { header: `Real (${detail.unit})`, width: 14 },
    ...table.methods.map((m) => ({ header: METHOD_LABELS[m.method] ?? m.method, width: 22 })),
    { header: 'Entra al MAD y MAPE', width: 20 },
  ];
  styleHeader(data.getRow(1));
  table.periods.forEach((period, i) => {
    const row = data.addRow([
      periodCell(period, detail.periodicity),
      table.actuals[i],
      ...table.methods.map((m) => m.values[i]),
      table.isNext[i] ? 'Pronosticado' : table.evaluated[i] ? 'Sí' : 'No',
    ]);
    for (let cell = 2; cell <= table.methods.length + 2; cell += 1) row.getCell(cell).numFmt = NUMBER;
    if (table.isNext[i]) row.fill = NEXT_FILL;
    else if (table.evaluated[i]) row.fill = EVALUATED_FILL;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

function styleHeader(row) {
  row.font = { bold: true };
  row.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFE3E5E8' } } };
  });
}
