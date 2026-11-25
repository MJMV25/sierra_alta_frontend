import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { DETAIL, fixtures } from './fixtures';
import { mockBackend, renderApp, session } from './utils';

const previews = (requests) => requests.filter((r) => r.method === 'POST' && r.url === '/api/v1/forecasts/preview');

describe('Hoja de datos', () => {
  it('el planeador ve la hoja, los KPIs y la comparación, sin editar ni guardar', async () => {
    const requests = mockBackend({ me: session('PLANNER'), handler: fixtures });
    renderApp('/');

    const sheet = await screen.findByRole('table', { name: 'Unidades producidas por referencia y mes' });
    expect(within(sheet).queryAllByRole('textbox')).toHaveLength(0);
    expect(within(sheet).getByRole('cell', { name: '130' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Exportar Excel' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Importar Excel' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Guardar pronóstico' })).not.toBeInTheDocument();

    // Mismo método mejor por MAD y por MAPE: una sola tarjeta.
    const best = await screen.findByRole('region', { name: 'Mejor método' });
    expect(best).toHaveTextContent('Promedio móvil simple');
    expect(screen.getByRole('region', { name: 'Pronóstico ago de 2026' })).toHaveTextContent('130');
    expect(screen.getByRole('table', { name: 'Comparación de métodos por MAD y MAPE' })).not.toHaveTextContent('Cumple');
    expect(screen.getByRole('table', { name: /Resultados de Promedio móvil simple/ })).toHaveTextContent('+10');

    // La primera consulta usa los datos guardados y los parámetros iniciales, con el estacional incluido.
    const body = previews(requests)[0].data;
    expect(body.actuals).toBeUndefined();
    expect(body.methods.map((m) => m.method)).toContain('SEASONAL_MULTIPLICATIVE');
  });

  it('si el mejor por MAD y por MAPE son distintos, muestra dos tarjetas', async () => {
    mockBackend({
      me: session('PLANNER'),
      handler: (req) => {
        const base = fixtures(req);
        if (req.url !== '/api/v1/forecasts/preview') return base;
        const comparison = { ...base.data.comparison, bestByMape: ['EXPONENTIAL_SMOOTHING'] };
        return { status: 200, data: { ...base.data, comparison } };
      },
    });
    renderApp('/');
    expect(await screen.findByRole('region', { name: 'Mejor por MAD' })).toHaveTextContent('Promedio móvil simple');
    expect(screen.getByRole('region', { name: 'Mejor por MAPE' })).toHaveTextContent('Suavizamiento exponencial');
  });

  it('el administrador corrige un mes: se recalcula con el dato sin guardar y luego se guarda', async () => {
    const ui = userEvent.setup();
    const requests = mockBackend({
      me: session('ADMIN'),
      handler: (req) =>
        req.method === 'PATCH'
          ? { status: 200, data: [{ seriesId: 1, dataVersion: 4, added: 0, corrected: 1, removed: 0 }] }
          : fixtures(req),
    });
    renderApp('/');

    const cell = await screen.findByRole('textbox', { name: 'Jersey Pro, Julio de 2026' });
    await screen.findByRole('region', { name: 'Mejor método' });
    await ui.clear(cell);
    await ui.type(cell, '150');

    expect(cell.closest('td')).toHaveClass('sheet__cell--changed');
    expect(screen.getByText('1 corrección sin guardar.')).toBeInTheDocument();
    await waitFor(() => expect(previews(requests).at(-1).data.actuals).toBeDefined());
    expect(previews(requests).at(-1).data.actuals.at(-1)).toEqual({ period: '2026-07', value: 150 });
    // Con datos sin guardar no se guarda el pronóstico: primero la hoja.
    expect(screen.getByRole('button', { name: 'Guardar pronóstico' })).toBeDisabled();

    await ui.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(await screen.findByText(/Se guardaron 1 corrección/)).toBeInTheDocument();
    expect(requests.find((r) => r.method === 'PATCH').data).toEqual({
      series: [{ seriesId: 1, dataVersion: 3, changes: [{ period: '2026-07', value: 150 }] }],
    });
  });

  it('borrar el último mes pide confirmación y envía el mes vacío', async () => {
    const ui = userEvent.setup();
    const requests = mockBackend({
      me: session('ADMIN'),
      handler: (req) => (req.method === 'PATCH' ? { status: 200, data: [] } : fixtures(req)),
    });
    renderApp('/');

    await ui.clear(await screen.findByRole('textbox', { name: 'Jersey Pro, Julio de 2026' }));
    await ui.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    const dialog = await screen.findByRole('alertdialog', { name: '¿Borrar meses?' });
    await ui.click(within(dialog).getByRole('button', { name: 'Guardar y borrar' }));

    await waitFor(() => expect(requests.some((r) => r.method === 'PATCH')).toBe(true));
    expect(requests.find((r) => r.method === 'PATCH').data.series[0].changes).toEqual([{ period: '2026-07', value: null }]);
  });

  it('un valor que no es entero no se puede guardar', async () => {
    const ui = userEvent.setup();
    mockBackend({ me: session('ADMIN'), handler: fixtures });
    renderApp('/');

    const cell = await screen.findByRole('textbox', { name: 'Jersey Pro, Agosto de 2026' });
    await ui.type(cell, '12,5');
    expect(cell).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText(/1 celda tiene un valor que no es una cantidad entera/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled();

    await ui.click(screen.getByRole('button', { name: 'Descartar cambios' }));
    expect(cell).toHaveValue('');
  });

  it('se mueve con Enter y flechas como en Excel y acepta un rango pegado', async () => {
    const ui = userEvent.setup();
    mockBackend({ me: session('ADMIN'), handler: fixtures });
    renderApp('/');

    const july = await screen.findByRole('textbox', { name: 'Jersey Pro, Julio de 2026' });
    july.focus();
    await ui.keyboard('{Enter}');
    expect(screen.getByRole('textbox', { name: 'Short Run, Julio de 2026' })).toHaveFocus();
    await ui.keyboard('{ArrowUp}');
    expect(july).toHaveFocus();

    const august = screen.getByRole('textbox', { name: 'Jersey Pro, Agosto de 2026' });
    august.focus();
    await ui.paste('140\t150\n7\t8');
    expect(august).toHaveValue('140');
    expect(screen.getByRole('textbox', { name: 'Jersey Pro, Septiembre de 2026' })).toHaveValue('150');
    expect(screen.getByRole('textbox', { name: 'Short Run, Agosto de 2026' })).toHaveValue('7');
  });

  it('si los pesos K no suman 1 no recalcula y lo avisa', async () => {
    const ui = userEvent.setup();
    const requests = mockBackend({ me: session('PLANNER'), handler: fixtures });
    renderApp('/');

    const k0 = await screen.findByRole('textbox', { name: 'K0 =' });
    await screen.findByRole('region', { name: 'Mejor método' });
    const before = previews(requests).length;
    await ui.clear(k0);
    await ui.type(k0, '0,6');

    expect(screen.getByText(/Suma de K: 1,1 \(debe ser 1\)/)).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(previews(requests)).toHaveLength(before);
  });

  it('el analista no edita la hoja pero guarda el pronóstico con sus parámetros', async () => {
    const ui = userEvent.setup();
    const requests = mockBackend({
      me: session('ANALYST'),
      handler: (req) =>
        req.method === 'POST' && req.url === '/api/v1/forecasts' ? { status: 201, data: DETAIL } : fixtures(req),
    });
    renderApp('/');

    const sheet = await screen.findByRole('table', { name: 'Unidades producidas por referencia y mes' });
    expect(within(sheet).queryAllByRole('textbox')).toHaveLength(0);
    await screen.findByRole('region', { name: 'Mejor método' });
    await ui.click(screen.getByRole('button', { name: 'Guardar pronóstico' }));

    expect(await screen.findByRole('link', { name: 'Ver el pronóstico guardado' })).toHaveAttribute('href', '/pronosticos/7');
    const post = requests.find((r) => r.method === 'POST' && r.url === '/api/v1/forecasts');
    expect(post.data.seriesId).toBe(1);
    expect(post.data.methods[0]).toEqual({ method: 'SIMPLE_MOVING_AVERAGE', periods: 3 });
    expect(post.headers.get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('Datos de ejemplo', () => {
  it('usa los parámetros del Excel y deja probar valores sin guardarlos', async () => {
    const ui = userEvent.setup();
    const requests = mockBackend({ me: session('PLANNER'), handler: fixtures });
    renderApp('/');

    await ui.click(await screen.findByRole('tab', { name: 'Datos de ejemplo' }));
    const cell = await screen.findByRole('textbox', { name: 'Caso 2 · ACME Tool Company, t = 4' });
    expect(screen.getByRole('textbox', { name: 'n =' })).toHaveValue('4');

    await ui.clear(cell);
    await ui.type(cell, '450');
    await waitFor(() => expect(previews(requests).at(-1).data.actuals?.at(-1)).toEqual({ period: '2000-04', value: 450 }));
    expect(previews(requests).at(-1).data.seriesId).toBe(3);
    expect(screen.queryByRole('button', { name: 'Guardar cambios' })).not.toBeInTheDocument();

    await ui.click(screen.getByRole('button', { name: 'Volver a los datos del Excel' }));
    expect(cell).toHaveValue('400');
    expect(requests.some((r) => r.method === 'PATCH')).toBe(false);
  });
});
