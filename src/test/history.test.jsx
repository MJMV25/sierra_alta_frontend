import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { lineOfField, parseObservations } from '../pages/history/parseObservations';
import { fixtures } from './fixtures';
import { mockBackend, problem, renderApp, session } from './utils';

describe('parseObservations', () => {
  it('acepta punto y coma, espacio, tabulación y coma decimal', () => {
    const { observations, errors } = parseObservations('2026-08;155\n2026-09 160,5\n\n2026-10\t0');
    expect(errors).toEqual([]);
    expect(observations).toEqual([
      { period: '2026-08', value: 155, line: 1 },
      { period: '2026-09', value: 160.5, line: 2 },
      { period: '2026-10', value: 0, line: 4 },
    ]);
  });

  it('acepta "mes,cantidad" como en un CSV', () => {
    expect(parseObservations('2026-08,155').observations).toEqual([{ period: '2026-08', value: 155, line: 1 }]);
  });

  it('informa cada línea inválida con su número', () => {
    const { errors } = parseObservations('2026-13;5\n2026-08;-3\n2026-09;1.200,5\nsolo');
    expect(errors).toHaveLength(4);
    expect(errors[0]).toMatch(/^Línea 1: "2026-13" no es un mes válido/);
    expect(errors[1]).toMatch(/^Línea 2: "-3" no es una cantidad válida/);
    expect(errors[2]).toMatch(/^Línea 3:/);
    expect(errors[3]).toMatch(/^Línea 4: escriba el mes y la cantidad/);
  });

  it('traduce el campo del backend a la línea del texto', () => {
    const { observations } = parseObservations('\n2026-08;1\n2026-09;2');
    expect(lineOfField('observations[1].value', observations)).toBe(3);
    expect(lineOfField('seriesId', observations)).toBeUndefined();
  });
});

describe('Históricos', () => {
  it('lista las referencias y muestra la producción de la elegida', async () => {
    const ui = userEvent.setup();
    mockBackend({ me: session('SUPERVISOR'), handler: fixtures });
    renderApp('/historicos');

    const row = (await screen.findByRole('rowheader', { name: /Jersey Pro/ })).closest('tr');
    expect(within(row).getByText('Producción (unidades)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver datos de Short Run' })).toBeDisabled();

    await ui.click(screen.getByRole('button', { name: 'Ver datos de Jersey Pro' }));
    expect(await screen.findByRole('heading', { name: 'Jersey Pro: producción mensual' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Producción mensual (unidades)' })).toBeInTheDocument();
    expect(screen.getByText('Ver tabla de datos (4 meses)')).toBeInTheDocument();
  });

  it('carga meses tras confirmar y avisa la nueva versión de datos', async () => {
    const ui = userEvent.setup();
    const requests = mockBackend({
      me: session('ANALYST'),
      handler: (req) =>
        req.method === 'POST' && req.url === '/api/v1/history/series/1/observations'
          ? {
              status: 201,
              data: { loadId: 4, seriesId: 1, observations: 2, firstPeriod: '2026-08', lastPeriod: '2026-09', loadedAt: '2026-11-05T15:00:00Z' },
            }
          : fixtures(req),
    });
    renderApp('/historicos');

    await ui.selectOptions(await screen.findByLabelText('Referencia'), '1');
    await ui.type(screen.getByLabelText('Meses y cantidades'), '2026-08;140{enter}2026-09;150,5');
    await ui.click(screen.getByRole('button', { name: 'Cargar históricos' }));

    const dialog = screen.getByRole('alertdialog', { name: 'Confirmar carga' });
    expect(dialog).toHaveTextContent('no se pueden borrar');
    await ui.click(within(dialog).getByRole('button', { name: 'Cargar' }));

    expect(await screen.findByText(/Se cargaron 2 meses de Jersey Pro/)).toHaveTextContent('Versión de datos: 4.');
    const post = requests.find((r) => r.method === 'POST');
    expect(post.data).toEqual({
      observations: [
        { period: '2026-08', value: 140 },
        { period: '2026-09', value: 150.5 },
      ],
    });
  });

  it('no envía si el texto tiene errores y muestra los del backend por línea', async () => {
    const ui = userEvent.setup();
    const requests = mockBackend({
      me: session('ANALYST'),
      handler: (req) =>
        req.method === 'POST'
          ? {
              status: 400,
              data: problem(400, 'validation', 'Datos inválidos.', {
                errors: [{ field: 'observations[1].value', message: 'Use como máximo 14 dígitos enteros y 4 decimales.' }],
              }),
            }
          : fixtures(req),
    });
    renderApp('/historicos');

    await ui.selectOptions(await screen.findByLabelText('Referencia'), '1');
    await ui.type(screen.getByLabelText('Meses y cantidades'), '2026-8;140');
    await ui.click(screen.getByRole('button', { name: 'Cargar históricos' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Línea 1: "2026-8" no es un mes válido');
    expect(requests.some((r) => r.method === 'POST')).toBe(false);

    await ui.clear(screen.getByLabelText('Meses y cantidades'));
    await ui.type(screen.getByLabelText('Meses y cantidades'), '2026-08;1{enter}2026-09;1.123456');
    await ui.click(screen.getByRole('button', { name: 'Cargar históricos' }));
    await ui.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cargar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Línea 2: Use como máximo 14 dígitos enteros y 4 decimales.');
  });

  it('muestra el detail de un 409 cuando el mes ya existe', async () => {
    const ui = userEvent.setup();
    mockBackend({
      me: session('ANALYST'),
      handler: (req) =>
        req.method === 'POST'
          ? { status: 409, data: problem(409, 'conflict', 'Ya hay datos para 2026-07.') }
          : fixtures(req),
    });
    renderApp('/historicos');

    await ui.selectOptions(await screen.findByLabelText('Referencia'), '1');
    await ui.type(screen.getByLabelText('Meses y cantidades'), '2026-07;140');
    await ui.click(screen.getByRole('button', { name: 'Cargar históricos' }));
    await ui.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cargar' }));
    expect(await screen.findByText('Ya hay datos para 2026-07.')).toBeInTheDocument();
  });
});
