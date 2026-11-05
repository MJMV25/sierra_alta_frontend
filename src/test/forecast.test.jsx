import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { DETAIL, fixtures } from './fixtures';
import { mockBackend, problem, renderApp, session } from './utils';

describe('Ejecutar pronóstico', () => {
  it('envía solo los métodos elegidos con sus parámetros y abre el resultado', async () => {
    const ui = userEvent.setup();
    const requests = mockBackend({
      me: session('PLANNER'),
      handler: (req) =>
        req.method === 'POST' && req.url === '/api/v1/forecasts' ? { status: 201, data: DETAIL } : fixtures(req),
    });
    renderApp('/pronosticos');

    // Short Run no tiene datos: no aparece. Jersey Pro es la única opción y queda elegida.
    const series = await screen.findByLabelText('Referencia');
    expect(within(series).queryByRole('option', { name: 'Short Run' })).not.toBeInTheDocument();
    expect(series).toHaveValue('1');

    await ui.click(screen.getByRole('checkbox', { name: 'Promedio móvil ponderado' }));
    await ui.click(screen.getByRole('checkbox', { name: 'Suavizamiento con tendencia (Holt)' }));
    await ui.clear(screen.getByLabelText('Meses a promediar (n)'));
    await ui.type(screen.getByLabelText('Meses a promediar (n)'), '1');
    await ui.clear(screen.getByLabelText('α (nivel)'));
    await ui.type(screen.getByLabelText('α (nivel)'), '0,0025');
    await ui.click(screen.getByRole('button', { name: 'Ejecutar pronóstico' }));

    expect(await screen.findByRole('heading', { name: 'Pronóstico n.º 7: Jersey Pro' })).toBeInTheDocument();
    const post = requests.find((r) => r.method === 'POST');
    expect(post.data).toEqual({
      seriesId: 1,
      methods: [
        { method: 'SIMPLE_MOVING_AVERAGE', periods: 1 },
        { method: 'EXPONENTIAL_SMOOTHING', alpha: 0.0025 },
      ],
    });
    expect(post.headers.get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('muestra los errores del backend junto al parámetro del método correcto', async () => {
    const ui = userEvent.setup();
    mockBackend({
      me: session('PLANNER'),
      handler: (req) =>
        req.method === 'POST'
          ? {
              status: 400,
              data: problem(400, 'validation', 'Datos inválidos.', {
                errors: [
                  { field: 'methods[1].weights', message: 'Los pesos deben sumar 1.' },
                  { field: 'methods[3].beta', message: 'β debe ser mayor que 0 y menor que 1.' },
                ],
              }),
            }
          : fixtures(req),
    });
    renderApp('/pronosticos');

    await ui.click(await screen.findByRole('button', { name: 'Ejecutar pronóstico' }));

    expect(await screen.findByText('Los pesos deben sumar 1.')).toBeInTheDocument();
    expect(screen.getByLabelText('β (tendencia)')).toHaveAccessibleDescription(/β debe ser mayor que 0 y menor que 1\./);
    expect(screen.getByLabelText('α (nivel)', { selector: '#EXPONENTIAL_SMOOTHING-alpha' })).not.toHaveAttribute('aria-invalid');
  });

  it('pide al menos un método sin llamar al backend', async () => {
    const ui = userEvent.setup();
    const requests = mockBackend({ me: session('ANALYST'), handler: fixtures });
    renderApp('/pronosticos');

    for (const name of [
      'Promedio móvil simple',
      'Promedio móvil ponderado',
      'Suavizamiento exponencial',
      'Suavizamiento con tendencia (Holt)',
    ]) {
      await ui.click(await screen.findByRole('checkbox', { name }));
    }
    await ui.click(screen.getByRole('button', { name: 'Ejecutar pronóstico' }));
    expect(screen.getByText('Elija al menos un método.')).toBeInTheDocument();
    expect(requests.some((r) => r.method === 'POST')).toBe(false);
  });

  it('cambia la cantidad de pesos y muestra su suma', async () => {
    const ui = userEvent.setup();
    mockBackend({ me: session('PLANNER'), handler: fixtures });
    renderApp('/pronosticos');

    await ui.selectOptions(await screen.findByLabelText('Cantidad de pesos'), '2');
    expect(screen.getByLabelText('Peso K0 (mes más reciente)')).toHaveValue('0,5');
    expect(screen.queryByLabelText('Peso K2')).not.toBeInTheDocument();
    expect(screen.getByText(/Suma actual: 0,8/)).toBeInTheDocument();
  });
});

describe('Resultado de un pronóstico', () => {
  it('muestra la comparación con parámetros, pronóstico siguiente, mejores y estado', async () => {
    mockBackend({ me: session('SUPERVISOR'), handler: fixtures });
    renderApp('/pronosticos/7');

    const table = await screen.findByRole('table', { name: 'Comparación de métodos por MAD y MAPE' });
    const sma = within(table).getByRole('rowheader', { name: 'Promedio móvil simple' }).closest('tr');
    expect(sma).toHaveTextContent('n = 1');
    expect(sma).toHaveTextContent('130');
    expect(within(sma).getByText('Menor MAD')).toBeInTheDocument();
    expect(within(sma).getByText('Menor MAPE')).toBeInTheDocument();
    expect(sma).toHaveTextContent('Cumple');

    const ses = within(table).getByRole('rowheader', { name: 'Suavizamiento exponencial' }).closest('tr');
    expect(ses).toHaveTextContent('α = 0,0025');
    expect(ses).toHaveTextContent('11,68 %');
    expect(ses).toHaveTextContent('No cumple');

    expect(screen.getByRole('columnheader', { name: /Pronóstico ago/ })).toBeInTheDocument();
    expect(screen.getByText(/Evaluado de may de 2026 a jul de 2026/)).toBeInTheDocument();
    expect(screen.getByText(/1 mes con producción 0 no entra al MAPE/)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Producción mensual (unidades)' })).toBeInTheDocument();
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
    mockBackend({ me: session('SUPERVISOR'), handler: fixtures });
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
