import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import LineChart from '../components/LineChart';
import ComparisonTable from '../pages/forecast/ComparisonTable';
import { summaryRows, tableCsv } from '../export/report';
import { formatPeriod, periodCell, periodWord } from '../format';
import { COMPARISON, DETAIL } from './fixtures';

// Casos de prueba del Excel (Spokane, ACME): el backend guarda t = 1 como 2000-01 y la interfaz muestra
// "t = n", como las columnas t y trimestre del Excel.
const TEST_DETAIL = { ...DETAIL, periodicity: 'PERIODO' };

describe('Periodos de los casos de prueba del Excel', () => {
  it('numera los periodos t = 1, 2, 3… y deja los meses de la empresa como meses', () => {
    expect(formatPeriod('2000-01', 'PERIODO')).toBe('t = 1');
    expect(formatPeriod('2000-12', 'PERIODO')).toBe('t = 12');
    expect(formatPeriod('2002-06', 'PERIODO')).toBe('t = 30');
    expect(formatPeriod('2026-09', 'MENSUAL')).toMatch(/2026/);
    expect(periodWord(30, 'PERIODO')).toBe('periodos');
    expect(periodWord(1, 'MENSUAL')).toBe('mes');
    expect(periodCell('2002-01', 'PERIODO')).toBe(25);
    expect(periodCell('2026-08', 'MENSUAL')).toBe('2026-08');
  });

  it('exporta la columna t para compararla fila a fila con el Excel', () => {
    const shifted = {
      ...TEST_DETAIL,
      actuals: TEST_DETAIL.actuals.map((a, i) => ({ ...a, period: `2000-0${i + 1}` })),
      methods: TEST_DETAIL.methods.map((m) => ({
        ...m,
        forecasts: m.forecasts.map((f) => ({ ...f, period: `2000-0${TEST_DETAIL.actuals.findIndex((a) => a.period === f.period) + 1}` })),
        nextForecast: m.nextForecast && { ...m.nextForecast, period: `2000-0${TEST_DETAIL.actuals.length + 1}` },
      })),
      periodFrom: '2000-01',
      periodTo: `2000-0${TEST_DETAIL.actuals.length}`,
    };
    const lines = tableCsv(shifted).replace('﻿', '').trim().split('\r\n');
    expect(lines[0].startsWith('Periodo (t);')).toBe(true);
    expect(lines[1].startsWith('1;')).toBe(true);
    expect(lines.at(-1).startsWith(`${TEST_DETAIL.actuals.length + 1};`)).toBe(true);
    const rows = Object.fromEntries(summaryRows(shifted, COMPARISON));
    expect(rows['Periodo histórico']).toBe(`t = 1 a t = ${TEST_DETAIL.actuals.length} (${TEST_DETAIL.actuals.length} periodos)`);
  });

  it('la comparación sin detalle (pantalla Indicadores) también muestra el rango en t', () => {
    render(<ComparisonTable comparison={{ ...COMPARISON, evaluationFrom: '2000-06', evaluationTo: '2002-06' }} periodicity="PERIODO" />);
    expect(screen.getByText(/Evaluado de t = 6 a t = 30, los mismos periodos/)).toBeInTheDocument();
  });

  it('el gráfico rotula el eje y la guía con t', () => {
    render(
      <LineChart
        title="Demanda por periodo (galones)"
        periods={['2000-01', '2000-02', '2000-03']}
        periodicity="PERIODO"
        series={[{ key: 'real', label: 'Demanda', color: 'black', values: [275, 291, 307] }]}
      />,
    );
    expect(screen.getByRole('img', { name: 'Demanda por periodo (galones)' })).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.queryByText(/ene/)).not.toBeInTheDocument();
  });
});
