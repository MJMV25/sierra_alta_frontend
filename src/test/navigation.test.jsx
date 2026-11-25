import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { fixtures } from './fixtures';
import { mockBackend, problem, renderApp, session } from './utils';

async function menuLabels() {
  const nav = await screen.findByRole('navigation', { name: 'Menú principal' });
  return within(nav)
    .getAllByRole('link')
    .map((link) => link.querySelector('.sidebar__label').textContent);
}

describe('Menú según permisos', () => {
  it.each([
    ['ADMIN', ['Hoja de datos', 'Pronósticos guardados', 'Indicadores', 'Usuarios']],
    ['PLANNER', ['Hoja de datos', 'Pronósticos guardados', 'Indicadores']],
    ['ANALYST', ['Hoja de datos', 'Pronósticos guardados', 'Indicadores']],
  ])('%s ve solo sus secciones', async (role, expected) => {
    mockBackend({ me: session(role), handler: fixtures });
    renderApp('/');
    expect(await menuLabels()).toEqual(expected);
  });

  it('se basa en los permisos y no en el nombre del rol', async () => {
    mockBackend({ me: session('PLANNER', { permissions: ['indicators:read'] }) });
    renderApp('/indicadores');
    expect(await menuLabels()).toEqual(['Indicadores']);
  });

  it('el inicio es la hoja de datos', async () => {
    mockBackend({ me: session('PLANNER'), handler: fixtures });
    renderApp('/');
    expect(await screen.findByRole('heading', { name: 'Hoja de datos y pronóstico' })).toBeInTheDocument();
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
    renderApp('/');
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
