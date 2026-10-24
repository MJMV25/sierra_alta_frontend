import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { http } from '../api/http';
import { SESSION_ENDED_MESSAGE } from '../auth/AuthProvider';
import { mockBackend, problem, renderApp, session } from './utils';

const CSRF_DETAIL = 'No se pudo verificar la solicitud. Recargue la página e intente de nuevo.';

async function fillLogin(user, username, password) {
  await user.type(await screen.findByLabelText('Usuario'), username);
  await user.type(screen.getByLabelText('Contraseña'), password);
  await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
}

describe('Inicio de sesión', () => {
  it('inicia sesión con credenciales válidas y muestra el inicio', async () => {
    const user = userEvent.setup();
    const requests = mockBackend({
      handler: (req) => {
        if (req.method === 'POST' && req.url === '/api/v1/auth/login') {
          return { status: 200, cookie: 'XSRF-TOKEN=csrf-renovado; path=/', data: session('PLANNER') };
        }
        return undefined;
      },
    });

    renderApp('/login');
    await fillLogin(user, 'planner', 'clave-segura-123');

    expect(await screen.findByRole('heading', { name: 'Bienvenido, planner' })).toBeInTheDocument();
    const loginRequest = requests.find((r) => r.url === '/api/v1/auth/login');
    expect(loginRequest.data).toEqual({ username: 'planner', password: 'clave-segura-123' });
  });

  it('muestra el detail del backend ante credenciales inválidas', async () => {
    const user = userEvent.setup();
    mockBackend({
      handler: (req) =>
        req.url === '/api/v1/auth/login'
          ? { status: 401, data: problem(401, 'invalid-credentials', 'Usuario o contraseña incorrectos.') }
          : undefined,
    });

    renderApp('/login');
    await fillLogin(user, 'planner', 'equivocada-123');

    expect(await screen.findByRole('alert')).toHaveTextContent('Usuario o contraseña incorrectos.');
    expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeEnabled();
    expect(screen.queryByRole('heading', { name: /Bienvenido/ })).not.toBeInTheDocument();
  });

  it('muestra los errores de validación junto a cada campo', async () => {
    const user = userEvent.setup();
    mockBackend({
      handler: (req) =>
        req.url === '/api/v1/auth/login'
          ? {
              status: 400,
              data: problem(400, 'validation', 'La solicitud contiene datos inválidos.', {
                errors: [{ field: 'username', message: 'El usuario es obligatorio.' }],
              }),
            }
          : undefined,
    });

    renderApp('/login');
    await user.type(await screen.findByLabelText('Contraseña'), 'x');
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

    const input = screen.getByLabelText('Usuario');
    await waitFor(() => expect(input).toHaveAttribute('aria-invalid', 'true'));
    expect(input).toHaveAccessibleDescription('El usuario es obligatorio.');
  });

  it('redirige al inicio si ya hay sesión', async () => {
    mockBackend({ me: session('SUPERVISOR') });
    renderApp('/login');
    expect(await screen.findByRole('heading', { name: 'Bienvenido, supervisor' })).toBeInTheDocument();
  });
});

describe('CSRF', () => {
  it('envía X-XSRF-TOKEN con el valor actual de la cookie en login y logout', async () => {
    const user = userEvent.setup();
    const requests = mockBackend({
      csrfToken: 'token-1',
      handler: (req) => {
        if (req.url === '/api/v1/auth/login') {
          // El backend renueva el token al autenticar.
          return { status: 200, cookie: 'XSRF-TOKEN=token-2; path=/', data: session('ANALYST') };
        }
        if (req.url === '/api/v1/auth/logout') return { status: 204 };
        return undefined;
      },
    });

    renderApp('/login');
    await fillLogin(user, 'analyst', 'clave-segura-123');
    await user.click(await screen.findByRole('button', { name: 'Cerrar sesión' }));
    await screen.findByRole('button', { name: 'Iniciar sesión' });

    const login = requests.find((r) => r.url === '/api/v1/auth/login');
    const logout = requests.find((r) => r.url === '/api/v1/auth/logout');
    expect(login.headers.get('X-XSRF-TOKEN')).toBe('token-1');
    expect(logout.headers.get('X-XSRF-TOKEN')).toBe('token-2');
    expect(requests.find((r) => r.url === '/api/v1/auth/me').headers.get('X-XSRF-TOKEN')).toBeFalsy();
  });

  it('ante csrf-invalid renueva el token y reintenta una sola vez', async () => {
    const user = userEvent.setup();
    let attempts = 0;
    const requests = mockBackend({
      handler: (req) => {
        if (req.url === '/api/v1/auth/login') {
          attempts += 1;
          return attempts === 1
            ? { status: 403, data: problem(403, 'csrf-invalid', CSRF_DETAIL) }
            : { status: 200, data: session('PLANNER') };
        }
        return undefined;
      },
    });

    renderApp('/login');
    await fillLogin(user, 'planner', 'clave-segura-123');

    expect(await screen.findByRole('heading', { name: 'Bienvenido, planner' })).toBeInTheDocument();
    expect(attempts).toBe(2);
    expect(requests.filter((r) => r.url === '/api/v1/auth/csrf')).toHaveLength(2);
  });

  it('si csrf-invalid se repite muestra el detail sin tratarlo como falta de permisos', async () => {
    const user = userEvent.setup();
    let attempts = 0;
    mockBackend({
      handler: (req) => {
        if (req.url === '/api/v1/auth/login') {
          attempts += 1;
          return { status: 403, data: problem(403, 'csrf-invalid', CSRF_DETAIL) };
        }
        return undefined;
      },
    });

    renderApp('/login');
    await fillLogin(user, 'planner', 'clave-segura-123');

    expect(await screen.findByRole('alert')).toHaveTextContent(CSRF_DETAIL);
    expect(attempts).toBe(2);
    expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeEnabled();
  });

  it('no reintenta un 403 access-denied', async () => {
    let attempts = 0;
    mockBackend({
      handler: (req) => {
        if (req.url === '/api/v1/admin/users') {
          attempts += 1;
          return { status: 403, data: problem(403, 'access-denied', 'No tiene permiso.') };
        }
        return undefined;
      },
    });

    await expect(http.post('/admin/users', {})).rejects.toMatchObject({ code: 'access-denied' });
    expect(attempts).toBe(1);
  });
});

describe('Sesión expirada', () => {
  it('ante un 401 redirige a /login con el mensaje de sesión terminada', async () => {
    mockBackend({
      me: session('ADMIN'),
      handler: (req) =>
        req.url.startsWith('/api/v1/admin/')
          ? { status: 401, data: problem(401, 'authentication-required', 'Debe iniciar sesión para continuar.') }
          : undefined,
    });

    renderApp('/admin/usuarios');

    expect(await screen.findByText(SESSION_ENDED_MESSAGE)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeInTheDocument();
  });
});
