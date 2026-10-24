import axios from 'axios';

export const CSRF_COOKIE = 'XSRF-TOKEN';
export const CSRF_HEADER = 'X-XSRF-TOKEN';
/** Versión de la API. Único lugar donde se define: las rutas de auth.js, admin.js y modules.js son relativas. */
export const API_PREFIX = '/api/v1';
const CSRF_PATH = '/auth/csrf';
const MUTATING_METHODS = ['post', 'put', 'patch', 'delete'];

/** Error normalizado a partir de una respuesta problem+json (RFC 9457). */
export class ApiError extends Error {
  constructor({ status, code, title, detail, errors }) {
    super(detail);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.title = title;
    this.detail = detail;
    this.errors = errors ?? [];
  }
}

// Solo se usan si el backend no envía un `detail` (p. ej. sin conexión o un proxy caído).
const FALLBACK_DETAIL = {
  0: 'No fue posible conectar con el servidor. Verifique su conexión e intente de nuevo.',
  401: 'Debe iniciar sesión para continuar.',
  403: 'No tiene permiso para realizar esta operación.',
  404: 'El recurso solicitado no existe.',
  500: 'Ocurrió un error inesperado.',
};

/** Lee la cookie en cada llamada: el login renueva el token, así que nunca se guarda en memoria. */
export function readCookie(name) {
  const prefix = `${name}=`;
  const match = document.cookie.split(';').map((c) => c.trim()).find((c) => c.startsWith(prefix));
  return match ? decodeURIComponent(match.slice(prefix.length)) : null;
}

const isMutating = (config) => MUTATING_METHODS.includes((config.method ?? 'get').toLowerCase());

function isProblemBody(data) {
  return data !== null && typeof data === 'object' && typeof data.status === 'number';
}

function toApiError(error) {
  const response = error.response;
  if (!response) {
    return new ApiError({ status: 0, code: 'network-error', detail: FALLBACK_DETAIL[0] });
  }
  const { status, data } = response;
  if (isProblemBody(data)) {
    return new ApiError({
      status,
      code: data.code,
      title: data.title,
      detail: data.detail || FALLBACK_DETAIL[status] || FALLBACK_DETAIL[500],
      errors: data.errors,
    });
  }
  return new ApiError({ status, code: null, detail: FALLBACK_DETAIL[status] || FALLBACK_DETAIL[500] });
}

export const http = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL || ''}${API_PREFIX}`,
  withCredentials: true,
  // El encabezado CSRF lo agrega el interceptor de solicitud; se desactiva el automático de Axios
  // para que haya una sola regla, válida también cuando VITE_API_URL apunta a otro origen.
  xsrfCookieName: null,
  headers: { Accept: 'application/json, application/problem+json' },
});

export function fetchCsrfToken() {
  return http.get(CSRF_PATH, { skipAuthHandling: true });
}

// Manejadores globales registrados por AuthProvider (401 → login, 403 access-denied → /sin-permiso).
let handlers = { onUnauthorized: null, onForbidden: null };

export function setAuthHandlers(next) {
  handlers = { onUnauthorized: null, onForbidden: null, ...next };
  return () => {
    handlers = { onUnauthorized: null, onForbidden: null };
  };
}

http.interceptors.request.use(async (config) => {
  if (isMutating(config)) {
    // Tras un logout el backend borra la cookie: se pide una nueva antes de enviar.
    if (!readCookie(CSRF_COOKIE)) {
      await fetchCsrfToken().catch(() => {});
    }
    const token = readCookie(CSRF_COOKIE);
    if (token) {
      config.headers.set(CSRF_HEADER, token);
    }
  }
  return config;
});

http.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config ?? {};
    const status = error.response?.status;

    // Token CSRF ausente o vencido: se renueva y se reintenta una sola vez. Si vuelve a fallar se
    // rechaza con su `detail`; no es falta de permisos, así que no llega a onForbidden.
    if (status === 403 && error.response.data?.code === 'csrf-invalid' && !config.csrfRetried) {
      await fetchCsrfToken().catch(() => {});
      return http.request({ ...config, csrfRetried: true });
    }

    const apiError = toApiError(error);
    if (!config.skipAuthHandling) {
      if (status === 401) handlers.onUnauthorized?.(apiError);
      else if (status === 403 && apiError.code === 'access-denied') handlers.onForbidden?.(apiError);
    }
    return Promise.reject(apiError);
  },
);
