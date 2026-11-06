import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { mockBackend, PERMISSIONS, problem, renderApp, session } from './utils';

const ROLES = [
  { code: 'ADMIN', name: 'Administrador del sistema', permissions: PERMISSIONS.ADMIN },
  { code: 'PLANNER', name: 'Planeador de producción', permissions: PERMISSIONS.PLANNER },
  { code: 'ANALYST', name: 'Analista de datos', permissions: PERMISSIONS.ANALYST },
];

const user = (id, username, role, active = true) => ({
  id,
  username,
  role,
  roleName: ROLES.find((r) => r.code === role).name,
  active,
  createdAt: '2026-10-01T15:00:00Z',
});

function adminBackend(extra = () => undefined) {
  const users = [user(1, 'admin', 'ADMIN'), user(2, 'planeador', 'PLANNER')];
  return mockBackend({
    me: session('ADMIN', { userId: 1, username: 'admin' }),
    handler: (req) => {
      const custom = extra(req);
      if (custom) return custom;
      if (req.url === '/api/v1/admin/roles') return { status: 200, data: ROLES };
      if (req.method === 'GET' && req.url === '/api/v1/admin/users') return { status: 200, data: users };
      return undefined;
    },
  });
}

describe('Administración de usuarios', () => {
  it('deshabilita el cambio de rol y estado en la fila del propio usuario', async () => {
    adminBackend();
    renderApp('/admin/usuarios');

    expect(await screen.findByLabelText('Rol de admin')).toBeDisabled();
    expect(screen.getByLabelText('Rol de planeador')).toBeEnabled();
    const adminRow = screen.getByLabelText('Rol de admin').closest('tr');
    expect(within(adminRow).getByRole('button', { name: 'Desactivar' })).toBeDisabled();
  });

  it('crea un usuario con el rol elegido en el select', async () => {
    const ui = userEvent.setup();
    const requests = adminBackend((req) =>
      req.method === 'POST' && req.url === '/api/v1/admin/users'
        ? { status: 201, data: user(3, 'nuevo.usuario', 'ANALYST') }
        : undefined,
    );
    renderApp('/admin/usuarios');

    await ui.type(await screen.findByLabelText('Usuario'), 'Nuevo.Usuario');
    await ui.type(screen.getByLabelText('Contraseña'), 'clave-segura-123');
    await ui.selectOptions(screen.getByLabelText('Rol'), 'ANALYST');
    await ui.click(screen.getByRole('button', { name: 'Crear usuario' }));

    expect(await screen.findByText(/Usuario "nuevo.usuario" creado/)).toBeInTheDocument();
    expect(screen.getByLabelText('Rol de nuevo.usuario')).toHaveValue('ANALYST');
    const post = requests.find((r) => r.method === 'POST' && r.url === '/api/v1/admin/users');
    expect(post.data).toEqual({ username: 'Nuevo.Usuario', password: 'clave-segura-123', role: 'ANALYST' });
    expect(post.headers.get('X-XSRF-TOKEN')).toBe('csrf-inicial');
  });

  it('desactiva un usuario tras confirmar y muestra el detail de un 422', async () => {
    const ui = userEvent.setup();
    adminBackend((req) =>
      req.url === '/api/v1/admin/users/2/status'
        ? { status: 422, data: problem(422, 'business-rule', 'Debe quedar al menos un administrador activo.') }
        : undefined,
    );
    renderApp('/admin/usuarios');

    const row = (await screen.findByLabelText('Rol de planeador')).closest('tr');
    await ui.click(within(row).getByRole('button', { name: 'Desactivar' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Desactivar usuario' });
    await ui.click(within(dialog).getByRole('button', { name: 'Desactivar' }));

    expect(await screen.findByText('Debe quedar al menos un administrador activo.')).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('cambia el rol tras confirmar', async () => {
    const ui = userEvent.setup();
    const requests = adminBackend((req) =>
      req.url === '/api/v1/admin/users/2/role' ? { status: 200, data: user(2, 'planeador', 'ANALYST') } : undefined,
    );
    renderApp('/admin/usuarios');

    await ui.selectOptions(await screen.findByLabelText('Rol de planeador'), 'ANALYST');
    await ui.click(screen.getByRole('button', { name: 'Cambiar rol' }));

    expect(await screen.findByText(/Rol de "planeador" cambiado a Analista de datos/)).toBeInTheDocument();
    expect(requests.find((r) => r.url === '/api/v1/admin/users/2/role').data).toEqual({ role: 'ANALYST' });
  });

  it('lista los eventos de seguridad', async () => {
    const ui = userEvent.setup();
    adminBackend((req) =>
      req.url === '/api/v1/admin/security-events'
        ? {
            status: 200,
            data: [{ id: 9, userId: 2, type: 'LOGIN', result: 'FAILURE', occurredAt: '2026-10-20T12:00:00Z' }],
          }
        : undefined,
    );
    renderApp('/admin/usuarios');

    await ui.click(await screen.findByRole('tab', { name: 'Eventos de seguridad' }));
    const table = await screen.findByRole('table', { name: /eventos de seguridad/ });
    expect(within(table).getByText('Inicio de sesión')).toBeInTheDocument();
    expect(within(table).getByText('Fallido')).toBeInTheDocument();
    expect(within(table).getByText('planeador')).toBeInTheDocument();
  });
});
