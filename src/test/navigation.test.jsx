import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { fixtures } from './fixtures';
import { mockBackend, problem, renderApp, session } from './utils';

async function menuLabels() {
  const nav = await screen.findByRole('navigation', { name: 'Menú principal' });
  return within(nav)
    .getAllByRole('link')
    .map((link) => link.textContent);
}

describe('Menú según permisos', () => {
  it.each([
    ['ADMIN', ['Inicio', 'Históricos', 'Pronósticos', 'Indicadores', 'Usuarios']],
    ['PLANNER', ['Inicio', 'Históricos', 'Pronósticos', 'Indicadores']],
    ['ANALYST', ['Inicio', 'Históricos', 'Pronósticos', 'Indicadores']],
  ])('%s ve solo sus secciones', async (role, expected) => {
    mockBackend({ me: session(role) });
    renderApp('/');
    expect(await menuLabels()).toEqual(expected);
  });

  it('se basa en los permisos y no en el nombre del rol', async () => {
    mockBackend({ me: session('PLANNER', { permissions: ['indicators:read'] }) });
    renderApp('/');
    expect(await menuLabels()).toEqual(['Inicio', 'Indicadores']);
  });

  it('muestra en el inicio tarjetas solo de los módulos permitidos', async () => {
    mockBackend({ me: session('PLANNER') });
    renderApp('/');
    await screen.findByRole('heading', { name: 'Bienvenido, planner' });
    const main = screen.getByRole('main');
    expect(within(main).getByRole('link', { name: /Históricos/ })).toBeInTheDocument();
    expect(within(main).queryByRole('link', { name: /Usuarios/ })).not.toBeInTheDocument();
  });
});

describe('Protección de rutas', () => {
  it('RequirePermission manda a /sin-permiso cuando falta el permiso', async () => {
    mockBackend({ me: session('PLANNER') });
    renderApp('/admin/usuarios');
    expect(await screen.findByRole('heading', { name: 'Sin permiso' })).toBeInTheDocument();
  });

  it('el analista no accede a la administración de usuarios', async () => {
    mockBackend({ me: session('ANALYST') });
    renderApp('/admin/usuarios');
    expect(await screen.findByRole('heading', { name: 'Sin permiso' })).toBeInTheDocument();
  });

  it('un 403 access-denied del backend lleva a /sin-permiso', async () => {
    mockBackend({
      me: session('PLANNER'),
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

describe('Acciones según permisos', () => {
  it('el planeador solo consulta: no ve "Cargar históricos" ni "Ejecutar pronóstico"', async () => {
    mockBackend({ me: session('PLANNER'), handler: fixtures });
    const { unmount } = renderApp('/historicos');
    await screen.findByRole('heading', { name: 'Referencias' });
    expect(screen.queryByRole('button', { name: 'Cargar históricos' })).not.toBeInTheDocument();
    unmount();

    renderApp('/pronosticos');
    await screen.findByRole('heading', { name: 'Ejecuciones recientes' });
    expect(screen.queryByRole('button', { name: 'Ejecutar pronóstico' })).not.toBeInTheDocument();
  });

  it('el analista carga históricos pero no ejecuta pronósticos', async () => {
    mockBackend({ me: session('ANALYST'), handler: fixtures });
    const { unmount } = renderApp('/historicos');
    expect(await screen.findByRole('button', { name: 'Cargar históricos' })).toBeInTheDocument();
    unmount();

    renderApp('/pronosticos');
    await screen.findByRole('heading', { name: 'Ejecuciones recientes' });
    expect(screen.queryByRole('button', { name: 'Ejecutar pronóstico' })).not.toBeInTheDocument();
  });

  it('el administrador carga históricos y es el único que ejecuta pronósticos', async () => {
    mockBackend({ me: session('ADMIN'), handler: fixtures });
    const { unmount } = renderApp('/historicos');
    expect(await screen.findByRole('button', { name: 'Cargar históricos' })).toBeInTheDocument();
    unmount();

    renderApp('/pronosticos');
    expect(await screen.findByRole('button', { name: 'Ejecutar pronóstico' })).toBeInTheDocument();
  });
});
