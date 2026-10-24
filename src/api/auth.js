import { http, fetchCsrfToken } from './http';

export { fetchCsrfToken };

/** El 401 del login es "credenciales inválidas": lo muestra el formulario, no el manejador global. */
export async function login(username, password) {
  const { data } = await http.post('/auth/login', { username, password }, { skipAuthHandling: true });
  return data;
}

/** Sesión actual. Un 401 aquí solo significa "no hay sesión". */
export async function getSession() {
  const { data } = await http.get('/auth/me', { skipAuthHandling: true });
  return data;
}

export async function logout() {
  await http.post('/auth/logout', null, { skipAuthHandling: true });
}
