import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { UNDER_CONSTRUCTION_MESSAGE } from '../components/UnderConstruction';
import { mockBackend, problem, renderApp, session } from './utils';

const notImplemented = (req) =>
  /^\/api\/v1\/(history|forecasts|indicators)/.test(req.url)
    ? { status: 501, data: problem(501, 'not-implemented', 'Funcionalidad no implementada.') }
    : undefined;

async function menuLabels() {
  const nav = await screen.findByRole('navigation', { name: 'Menú principal' });
  return within(nav)
    .getAllByRole('link')
    .map((link) => link.textContent);
}

describe('Menú según permisos', () => {
  it.each([
    ['ADMIN', ['Inicio', 'Usuarios']],
    ['PLANNER', ['Inicio', 'Históricos', 'Pronósticos', 'Indicadores']],
    ['SUPERVISOR', ['Inicio', 'Históricos', 'Pronósticos', 'Indicadores']],
    ['ANALYST', ['Inicio', 'Históricos', 'Pronósticos', 'Indicadores']],
  ])('%s ve solo sus secciones', async (role, expected) => {
    mockBackend({ me: session(role) });
    renderApp('/');
    expect(await menuLabels()).toEqual(expected);
  });

  it('se basa en los permisos y no en el nombre del rol', async () => {
    mockBackend({ me: session('SUPERVISOR', { permissions: ['indicators:read'] }) });
    renderApp('/');
    expect(await menuLabels()).toEqual(['Inicio', 'Indicadores']);
  });

  it('muestra en el inicio tarjetas solo de los módulos permitidos', async () => {
    mockBackend({ me: session('ADMIN') });
    renderApp('/');
    await screen.findByRole('heading', { name: 'Bienvenido, admin' });
    const main = screen.getByRole('main');
    expect(within(main).getByRole('link', { name: /Usuarios/ })).toBeInTheDocument();
    expect(within(main).queryByRole('link', { name: /Históricos/ })).not.toBeInTheDocument();
  });
});

describe('Protección de rutas', () => {
  it('RequirePermission manda a /sin-permiso cuando falta el permiso', async () => {
    mockBackend({ me: session('PLANNER') });
    renderApp('/admin/usuarios');
    expect(await screen.findByRole('heading', { name: 'Sin permiso' })).toBeInTheDocument();
  });

  it('el administrador no accede a históricos', async () => {
    mockBackend({ me: session('ADMIN') });
    renderApp('/historicos');
    expect(await screen.findByRole('heading', { name: 'Sin permiso' })).toBeInTheDocument();
  });

  it('un 403 access-denied del backend lleva a /sin-permiso', async () => {
    mockBackend({
      me: session('SUPERVISOR'),
      handler: (req) =>
        req.url === '/api/v1/history/products'
          ? { status: 403, data: problem(403, 'access-denied', 'Su rol no tiene permiso para realizar esta operación.') }
          : undefined,
    });
    renderApp('/historicos');
    expect(await screen.findByRole('heading', { name: 'Sin permiso' })).toBeInTheDocument();
  });

  it('sin sesión redirige al login', async () => {
    mockBackend();
    renderApp('/pronosticos');
    expect(await screen.findByRole('button', { name: 'Iniciar sesión' })).toBeInTheDocument();
  });

  it('muestra 404 en rutas inexistentes', async () => {
    mockBackend({ me: session('PLANNER') });
    renderApp('/no-existe');
    expect(await screen.findByRole('heading', { name: 'Página no encontrada' })).toBeInTheDocument();
  });
});

describe('Módulos en construcción', () => {
  it('históricos muestra el aviso ante 501 y "Cargar históricos" solo con history:write', async () => {
    mockBackend({ me: session('ANALYST'), handler: notImplemented });
    renderApp('/historicos');
    expect(await screen.findByText(UNDER_CONSTRUCTION_MESSAGE)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cargar históricos' })).toBeInTheDocument();
  });

  it('el supervisor no ve "Cargar históricos" ni "Ejecutar pronóstico"', async () => {
    mockBackend({ me: session('SUPERVISOR'), handler: notImplemented });
    const { unmount } = renderApp('/historicos');
    await screen.findByText(UNDER_CONSTRUCTION_MESSAGE);
    expect(screen.queryByRole('button', { name: 'Cargar históricos' })).not.toBeInTheDocument();
    unmount();

    renderApp('/pronosticos');
    await screen.findByText(UNDER_CONSTRUCTION_MESSAGE);
    expect(screen.queryByRole('button', { name: 'Ejecutar pronóstico' })).not.toBeInTheDocument();
  });

  it('el planeador ve "Ejecutar pronóstico"', async () => {
    mockBackend({ me: session('PLANNER'), handler: notImplemented });
    renderApp('/pronosticos');
    await screen.findByText(UNDER_CONSTRUCTION_MESSAGE);
    expect(screen.getByRole('button', { name: 'Ejecutar pronóstico' })).toBeInTheDocument();
  });
});
