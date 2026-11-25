import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { fixtures } from './fixtures';
import { mockBackend, problem, renderApp, session } from './utils';

describe('Resultado de un pronóstico', () => {
  it('muestra la comparación con parámetros, pronóstico siguiente y mejores, sin estado', async () => {
    mockBackend({ me: session('PLANNER'), handler: fixtures });
    renderApp('/pronosticos/7');

    const table = await screen.findByRole('table', { name: 'Comparación de métodos por MAD y MAPE' });
    const sma = within(table).getByRole('rowheader', { name: 'Promedio móvil simple' }).closest('tr');
    expect(sma).toHaveTextContent('n = 1');
    expect(sma).toHaveTextContent('130');
    expect(within(sma).getByText('Menor MAD')).toBeInTheDocument();
    expect(within(sma).getByText('Menor MAPE')).toBeInTheDocument();
    expect(table).not.toHaveTextContent(/Cumple|Estado/);

    const ses = within(table).getByRole('rowheader', { name: 'Suavizamiento exponencial' }).closest('tr');
    expect(ses).toHaveTextContent('α = 0,0025');
    expect(ses).toHaveTextContent('11,68 %');

    expect(screen.getByRole('columnheader', { name: /Pronóstico ago/ })).toBeInTheDocument();
    expect(screen.getByText(/Evaluado de may de 2026 a jul de 2026/)).toBeInTheDocument();
    expect(screen.getByText(/1 mes con producción 0 no entra al MAPE/)).toBeInTheDocument();
    expect(await screen.findByRole('img', { name: 'Producción mensual (unidades)' })).toBeInTheDocument();
  });

  it('una ejecución inexistente muestra el detail del 404', async () => {
    mockBackend({
      me: session('PLANNER'),
      handler: (req) =>
        req.url === '/api/v1/forecasts/99'
          ? { status: 404, data: problem(404, 'not-found', 'No existe la ejecución con id 99.') }
          : undefined,
    });
    renderApp('/pronosticos/99');
    expect(await screen.findByText('No existe la ejecución con id 99.')).toBeInTheDocument();
  });

  it('las ejecuciones recientes enlazan a su resultado', async () => {
    mockBackend({ me: session('PLANNER'), handler: fixtures });
    renderApp('/pronosticos');
    expect(await screen.findByRole('link', { name: 'Ver ejecución 7' })).toHaveAttribute('href', '/pronosticos/7');
  });
});

describe('Indicadores', () => {
  it('muestra la comparación de la ejecución elegida en la URL', async () => {
    mockBackend({ me: session('PLANNER'), handler: fixtures });
    renderApp('/indicadores?ejecucion=7');

    expect(await screen.findByRole('heading', { name: 'Ejecución n.º 7' })).toBeInTheDocument();
    const table = await screen.findByRole('table', { name: 'Comparación de métodos por MAD y MAPE' });
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    expect(screen.getByRole('link', { name: 'Ver pronóstico completo' })).toHaveAttribute('href', '/pronosticos/7');
  });

  it('sin ejecución elegida solo lista las ejecuciones', async () => {
    mockBackend({ me: session('PLANNER'), handler: fixtures });
    renderApp('/indicadores');
    expect(await screen.findByRole('link', { name: 'Ver indicadores ejecución 7' })).toHaveAttribute(
      'href',
      '/indicadores?ejecucion=7',
    );
    expect(screen.queryByRole('table', { name: 'Comparación de métodos por MAD y MAPE' })).not.toBeInTheDocument();
  });
});
