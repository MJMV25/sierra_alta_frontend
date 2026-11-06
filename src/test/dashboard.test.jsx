import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import LineChart from '../components/LineChart';
import { forecastTable, summaryRows, tableCsv, warnings } from '../export/report';
import { sortRows } from '../pages/forecast/ComparisonTable';
import { COMPARISON, DETAIL, fixtures } from './fixtures';
import { mockBackend, renderApp, session } from './utils';

describe('Periodo histórico del pronóstico', () => {
  it('envía el periodo elegido e indica qué mes se pronostica', async () => {
    const ui = userEvent.setup();
    const requests = mockBackend({
      me: session('ADMIN'),
      handler: (req) =>
        req.method === 'POST' && req.url === '/api/v1/forecasts' ? { status: 201, data: DETAIL } : fixtures(req),
    });
    renderApp('/pronosticos');

    // Por defecto, toda la serie.
    expect(await screen.findByLabelText('Desde')).toHaveValue('2026-04');
    expect(screen.getByLabelText('Hasta')).toHaveValue('2026-07');
    expect(screen.getByText(/Se usan 4 meses y se pronostica ago de 2026/)).toBeInTheDocument();

    await ui.selectOptions(screen.getByLabelText('Desde'), '2026-05');
    await ui.selectOptions(screen.getByLabelText('Hasta'), '2026-06');
    expect(screen.getByText(/Se usan 2 meses y se pronostica jul de 2026/)).toBeInTheDocument();
    await ui.click(screen.getByRole('button', { name: 'Ejecutar pronóstico' }));

    await screen.findByRole('heading', { name: /Pronóstico n.º 7/ });
    const post = requests.find((r) => r.method === 'POST');
    expect(post.data).toMatchObject({ seriesId: 1, from: '2026-05', to: '2026-06' });
  });

  it('no envía un periodo con el mes final antes del inicial', async () => {
    const ui = userEvent.setup();
    const requests = mockBackend({ me: session('ADMIN'), handler: fixtures });
    renderApp('/pronosticos');

    await ui.selectOptions(await screen.findByLabelText('Desde'), '2026-07');
    await ui.selectOptions(screen.getByLabelText('Hasta'), '2026-05');
    await ui.click(screen.getByRole('button', { name: 'Ejecutar pronóstico' }));

    expect(screen.getByText('El mes final no puede ser anterior al inicial.')).toBeInTheDocument();
    expect(requests.some((r) => r.method === 'POST')).toBe(false);

    await ui.click(screen.getByRole('button', { name: 'Usar toda la serie' }));
    expect(screen.getByLabelText('Desde')).toHaveValue('2026-04');
  });
});

describe('Dashboard de un pronóstico', () => {
  it('muestra quién ejecutó y el periodo usado', async () => {
    mockBackend({ me: session('PLANNER'), handler: fixtures });
    renderApp('/pronosticos/7');
    expect(await screen.findByText(/Periodo histórico de abr de 2026 a jul de 2026 \(4 meses\)/)).toHaveTextContent(
      'por admin',
    );
  });

  it('ordena la comparación por MAPE y grafica MAD y MAPE por separado con el umbral', async () => {
    const ui = userEvent.setup();
    mockBackend({ me: session('PLANNER'), handler: fixtures });
    renderApp('/pronosticos/7');

    const table = await screen.findByRole('table', { name: 'Comparación de métodos por MAD y MAPE' });
    await ui.selectOptions(screen.getByLabelText('Ordenar'), 'mape');
    const methods = within(table)
      .getAllByRole('rowheader')
      .map((cell) => cell.textContent);
    expect(methods).toEqual(['Promedio móvil simple', 'Suavizamiento exponencial']);

    const mad = screen.getByRole('figure', { name: /^MAD \(unidades\)/ });
    expect(within(mad).getByText(/10 ★/)).toBeInTheDocument();
    const mape = screen.getByRole('figure', { name: /^MAPE/ });
    expect(within(mape).getByText('11,68 %')).toBeInTheDocument();
    expect(within(mape).getByText(/Umbral: cumple con MAPE menor que 10 %/)).toBeInTheDocument();
  });

  it('oculta series, cambia el tipo de gráfico y restablece la vista', async () => {
    const ui = userEvent.setup();
    mockBackend({ me: session('PLANNER'), handler: fixtures });
    const { container } = renderApp('/pronosticos/7');
    await screen.findByRole('img', { name: 'Producción mensual (unidades)' });
    const legend = () => [...container.querySelectorAll('.chart__legend li')].map((li) => li.textContent);

    await ui.click(screen.getByRole('checkbox', { name: 'Suavizamiento' }));
    expect(legend()).toEqual(['Producción real', 'Promedio móvil simple']);

    await ui.click(screen.getByRole('radio', { name: 'Columnas' }));
    expect(screen.getByRole('checkbox', { name: /Eje Y desde 0/ })).toBeDisabled();
    // Real y SMA en columnas: 4 reales + 3 pronósticos + agosto.
    expect(container.querySelectorAll('.chart__plot g[fill] path')).toHaveLength(8);

    await ui.selectOptions(screen.getByRole('combobox', { name: 'Desde' }), '2026-06');
    expect(container.querySelectorAll('.chart__plot text.chart__axis')).toHaveLength(3);

    await ui.click(screen.getByRole('button', { name: 'Restablecer vista' }));
    expect(legend()).toHaveLength(3);
    expect(screen.getByRole('radio', { name: 'Líneas' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Restablecer vista' })).toBeDisabled();
  });

  it('el planeador puede exportar y el analista no', async () => {
    mockBackend({ me: session('PLANNER'), handler: fixtures });
    const planner = renderApp('/pronosticos/7');
    expect(await screen.findByRole('button', { name: 'Exportar a Excel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Exportar a PDF' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Descargar tabla (CSV)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Descargar PNG' })).toBeInTheDocument();
    planner.unmount();

    mockBackend({ me: session('ANALYST'), handler: fixtures });
    renderApp('/pronosticos/7');
    await screen.findByRole('img', { name: 'Producción mensual (unidades)' });
    expect(screen.queryByRole('button', { name: 'Exportar a Excel' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Descargar/ })).not.toBeInTheDocument();
  });
});

describe('Contenido de la exportación', () => {
  it('la tabla CSV usa ";" y coma decimal, y marca los meses evaluados y el pronosticado', () => {
    const lines = tableCsv(DETAIL).replace('﻿', '').trim().split('\r\n');
    expect(lines[0]).toBe('Mes;Real (unidades);Promedio móvil simple;Suavizamiento exponencial;Entra al MAD y MAPE');
    expect(lines[1]).toBe('2026-04;100;;;No');
    expect(lines[4]).toBe('2026-07;130;120;112,5;Sí');
    expect(lines[5]).toBe('2026-08;;130;121,25;Mes pronosticado');
  });

  it('la ficha trae referencia, periodo, evaluación, umbral, usuario y versiones', () => {
    const rows = Object.fromEntries(summaryRows(DETAIL, COMPARISON));
    expect(rows.Referencia).toBe('JERSEY-PRO · Jersey Pro');
    expect(rows['Periodo histórico']).toBe('abr de 2026 a jul de 2026 (4 meses)');
    expect(rows['Rango de evaluación']).toBe('may de 2026 a jul de 2026');
    expect(rows['Umbral de aceptación']).toBe('MAPE menor que 10 %');
    expect(rows['Ejecutado por']).toBe('admin');
    expect(rows['Versión de datos']).toBe('3');
    expect(warnings(DETAIL, COMPARISON)).toEqual([
      'Suavizamiento exponencial: 1 mes con producción 0 fuera del MAPE (sí en el MAD).',
    ]);
  });

  it('ordena por MAD dejando al final los no calculables', () => {
    const rows = [
      { method: 'A', mad: null },
      { method: 'B', mad: 5 },
      { method: 'C', mad: 2 },
    ];
    expect(sortRows(rows, 'mad').map((r) => r.method)).toEqual(['C', 'B', 'A']);
    expect(sortRows(rows, 'method')).toBe(rows);
    expect(forecastTable(DETAIL).isNext).toEqual([false, false, false, false, true]);
  });
});

describe('Opciones del gráfico', () => {
  const periods = ['2026-01', '2026-02', '2026-03'];
  const series = [
    { key: 'real', label: 'Real', color: '#111214', values: [100, 120, 110] },
    { key: 'sma', label: 'SMA', color: '#2a78d6', values: [null, 100, 110] },
  ];

  it('combinado: el real en columnas y los métodos en línea', () => {
    const { container } = render(
      <LineChart title="Producción" periods={periods} series={series} type="combo" columnKeys={['real']} />,
    );
    expect(container.querySelectorAll('.chart__plot g[fill] path')).toHaveLength(3);
    expect(container.querySelectorAll('.chart__plot > path')).toHaveLength(1);
  });

  it('con valores escribe cada número y la escala ajustada no arranca en 0', () => {
    const { container } = render(
      <LineChart title="Producción" periods={periods} series={series} showValues zeroBased={false} />,
    );
    const values = [...container.querySelectorAll('.chart__values text')].map((t) => t.textContent);
    expect(values).toEqual(expect.arrayContaining(['100', '120', '110']));
    const ticks = [...container.querySelectorAll('.chart__y-axis text')].map((t) => t.textContent);
    expect(ticks[0]).not.toBe('0');
  });
});

describe('Libro de Excel', () => {
  it('trae la ficha, la comparación, las advertencias y los datos por mes', async () => {
    const { buildWorkbook } = await import('../export/excel');
    const { default: ExcelJS } = await import('exceljs');
    const blob = await buildWorkbook(DETAIL, COMPARISON);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await blob.arrayBuffer());

    const summary = workbook.getWorksheet('Resumen');
    const texts = [];
    summary.eachRow((row) => texts.push(row.values.filter(Boolean).join(' | ')));
    expect(texts).toContain('Ejecutado por | admin');
    expect(texts).toContain('Rango de evaluación | may de 2026 a jul de 2026');
    expect(texts.find((t) => t.startsWith('Promedio móvil simple'))).toContain('Cumple · menor MAD · menor MAPE');
    expect(texts).toContain('Suavizamiento exponencial: 1 mes con producción 0 fuera del MAPE (sí en el MAD).');

    const data = workbook.getWorksheet('Datos');
    expect(data.getRow(1).values.slice(1)).toEqual([
      'Mes', 'Real (unidades)', 'Promedio móvil simple', 'Suavizamiento exponencial', 'Entra al MAD y MAPE',
    ]);
    expect(data.getRow(6).values.slice(1)).toEqual(['2026-08', undefined, 130, 121.25, 'Mes pronosticado']);
  });
});
