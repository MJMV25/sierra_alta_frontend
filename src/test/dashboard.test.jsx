import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import LineChart from '../components/LineChart';
import { forecastTable, summaryRows, tableCsv, warnings } from '../export/report';
import { sortRows } from '../pages/forecast/ComparisonTable';
import { COMPARISON, DETAIL, fixtures } from './fixtures';
import { mockBackend, renderApp, session } from './utils';

describe('Dashboard de un pronóstico', () => {
  it('muestra quién ejecutó y el periodo usado', async () => {
    mockBackend({ me: session('PLANNER'), handler: fixtures });
    renderApp('/pronosticos/7');
    expect(await screen.findByText(/Periodo histórico de abr de 2026 a jul de 2026 \(4 meses\)/)).toHaveTextContent(
      'por admin',
    );
  });

  it('ordena la comparación por MAPE y grafica MAD y MAPE por separado, sin umbral', async () => {
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
    expect(within(mape).queryByText(/Umbral/)).not.toBeInTheDocument();
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

  it('cambia el color de una serie en gráfico, tabla y barras, lo recuerda y lo restablece', async () => {
    const ui = userEvent.setup();
    mockBackend({ me: session('PLANNER'), handler: fixtures });
    const { container, unmount } = renderApp('/pronosticos/7');
    await screen.findByRole('img', { name: 'Producción mensual (unidades)' });

    const picker = screen.getByLabelText('Color de Promedio móvil simple');
    fireEvent.input(picker, { target: { value: '#ff0000' } });

    const red = 'rgb(255, 0, 0)';
    expect(container.querySelector('.chart__plot [stroke="#ff0000"]')).not.toBeNull();
    expect(container.querySelector('.table__swatch').style.background).toBe(red);
    expect([...container.querySelectorAll('.bars__bar')].some((bar) => bar.style.background === red)).toBe(true);
    expect(JSON.parse(localStorage.getItem('sierra-alta:colores-series'))).toEqual({ SIMPLE_MOVING_AVERAGE: '#ff0000' });

    // Otra visita en el mismo navegador conserva el color elegido.
    unmount();
    const again = renderApp('/pronosticos/7');
    await screen.findByRole('img', { name: 'Producción mensual (unidades)' });
    expect(screen.getByLabelText('Color de Promedio móvil simple')).toHaveValue('#ff0000');

    await ui.click(screen.getByRole('button', { name: 'Restablecer vista' }));
    expect(again.container.querySelector('.chart__plot [stroke="#ff0000"]')).toBeNull();
    expect(localStorage.getItem('sierra-alta:colores-series')).toBeNull();
    expect(screen.getByRole('button', { name: 'Restablecer vista' })).toBeDisabled();
  });

  it('muestra L del estacional y advierte que su MAD no es comparable', async () => {
    const seasonal = {
      ...DETAIL.methods[0],
      method: 'SEASONAL_MULTIPLICATIVE',
      periods: null,
      seasonLength: 2,
      mad: 3,
      mapePercent: 2.5,
    };
    const detail = { ...DETAIL, methods: [...DETAIL.methods, seasonal] };
    const comparison = {
      ...COMPARISON,
      methods: [...COMPARISON.methods, { ...COMPARISON.methods[0], method: 'SEASONAL_MULTIPLICATIVE', mad: 3 }],
    };
    mockBackend({
      me: session('PLANNER'),
      handler: (req) => {
        if (req.url === '/api/v1/forecasts/7') return { status: 200, data: detail };
        if (req.url === '/api/v1/indicators/executions/7') return { status: 200, data: comparison };
        return fixtures(req);
      },
    });
    renderApp('/pronosticos/7');

    const table = await screen.findByRole('table', { name: 'Comparación de métodos por MAD y MAPE' });
    const row = within(table).getByRole('rowheader', { name: 'Estacional multiplicativo' }).closest('tr');
    expect(row).toHaveTextContent('L = 2');
    expect(screen.getByText(/no son comparables con los de los otros métodos/)).toBeInTheDocument();
    expect(screen.getByLabelText('Color de Estacional multiplicativo')).toBeInTheDocument();
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
    expect(lines[5]).toBe('2026-08;;130;121,25;Pronosticado');
  });

  it('la ficha trae referencia, periodo, evaluación, usuario y versiones', () => {
    const rows = Object.fromEntries(summaryRows(DETAIL, COMPARISON));
    expect(rows.Referencia).toBe('JERSEY-PRO · Jersey Pro');
    expect(rows['Periodo histórico']).toBe('abr de 2026 a jul de 2026 (4 meses)');
    expect(rows['Rango de evaluación']).toBe('may de 2026 a jul de 2026');
    expect(rows['Umbral de aceptación']).toBeUndefined();
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
    expect(texts.find((t) => t.startsWith('Promedio móvil simple'))).toContain('menor MAD · menor MAPE');
    expect(texts).toContain('Suavizamiento exponencial: 1 mes con producción 0 fuera del MAPE (sí en el MAD).');

    const data = workbook.getWorksheet('Datos');
    expect(data.getRow(1).values.slice(1)).toEqual([
      'Mes', 'Real (unidades)', 'Promedio móvil simple', 'Suavizamiento exponencial', 'Entra al MAD y MAPE',
    ]);
    expect(data.getRow(6).values.slice(1)).toEqual(['2026-08', undefined, 130, 121.25, 'Pronosticado']);
  });
});
