// Textos en español para los códigos que envía el backend. Solo presentación.

export const EVENT_TYPE_LABELS = {
  LOGIN: 'Inicio de sesión',
  LOGOUT: 'Cierre de sesión',
  ACCESS_DENIED: 'Acceso denegado',
  USER_CREATED: 'Usuario creado',
  USER_ACTIVATED: 'Usuario activado',
  USER_DEACTIVATED: 'Usuario desactivado',
  ROLE_CHANGED: 'Cambio de rol',
};

export const EVENT_RESULT_LABELS = {
  SUCCESS: 'Exitoso',
  FAILURE: 'Fallido',
  DENIED: 'Denegado',
};

const dateFormat = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' });

export function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateFormat.format(date);
}
