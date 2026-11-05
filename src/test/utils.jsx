import { render } from '@testing-library/react';
import { AxiosError } from 'axios';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { http } from '../api/http';
import { AuthProvider } from '../auth/AuthProvider';
import AppRoutes from '../routes';

export const PERMISSIONS = {
  ADMIN: ['users:manage', 'history:read', 'history:write', 'forecast:execute', 'forecast:read', 'indicators:read'],
  PLANNER: ['history:read', 'forecast:read', 'indicators:read'],
  ANALYST: ['history:read', 'history:write', 'forecast:read', 'indicators:read'],
};

const ROLE_NAMES = {
  ADMIN: 'Administrador del sistema',
  PLANNER: 'Planeador de producción',
  ANALYST: 'Analista de datos',
};

export function session(role, overrides = {}) {
  return {
    userId: 1,
    username: role.toLowerCase(),
    role,
    roleName: ROLE_NAMES[role],
    permissions: PERMISSIONS[role],
    ...overrides,
  };
}

export function problem(status, code, detail, extra = {}) {
  return { type: `urn:sierra-alta:problem:${code}`, title: 'Error', status, detail, code, ...extra };
}

/**
 * Sustituye el adaptador de Axios. `handler(req)` recibe { method, url, headers, data }
 * y devuelve { status, data, cookie? }. Las rutas no manejadas responden 404.
 * Devuelve la lista de solicitudes recibidas para inspeccionarlas.
 */
export function mockApi(handler) {
  const requests = [];
  http.defaults.adapter = vi.fn(async (config) => {
    // Ruta completa tal como la recibiría el backend (baseURL incluye el prefijo /api/v1).
    const url = `${config.baseURL ?? ''}${config.url}`;
    const req = {
      method: config.method.toUpperCase(),
      url,
      params: config.params,
      headers: config.headers,
      data: config.data ? JSON.parse(config.data) : undefined,
    };
    requests.push(req);
    const result = (await handler(req)) ?? { status: 404, data: problem(404, 'not-found', 'No existe.') };
    if (result.cookie) document.cookie = result.cookie;
    const response = { status: result.status, statusText: '', data: result.data ?? '', headers: {}, config };
    if (result.status >= 200 && result.status < 300) return response;
    throw new AxiosError(`HTTP ${result.status}`, 'ERR_BAD_RESPONSE', config, null, response);
  });
  return requests;
}

/** Atiende /csrf y /me; el resto lo delega en `handler`. */
export function mockBackend({ me = null, handler = () => undefined, csrfToken = 'csrf-inicial' } = {}) {
  return mockApi((req) => {
    if (req.method === 'GET' && req.url === '/api/v1/auth/csrf') {
      return {
        status: 200,
        cookie: `XSRF-TOKEN=${csrfToken}; path=/`,
        data: { headerName: 'X-XSRF-TOKEN', token: csrfToken },
      };
    }
    const custom = handler(req);
    if (custom) return custom;
    if (req.method === 'GET' && req.url === '/api/v1/auth/me') {
      return me
        ? { status: 200, data: me }
        : { status: 401, data: problem(401, 'authentication-required', 'Debe iniciar sesión para continuar.') };
    }
    return undefined;
  });
}

export function renderApp(route = '/') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </MemoryRouter>,
  );
}
