/** Secciones de la aplicación. El menú se filtra por `permission`, nunca por nombre de rol. */
export const MODULES = [
  {
    path: '/',
    label: 'Hoja de datos',
    hint: 'Datos, parámetros y pronóstico en vivo',
    icon: 'sheet',
    permission: 'history:read',
  },
  {
    path: '/pronosticos',
    label: 'Pronósticos guardados',
    hint: 'Ejecuciones con trazabilidad',
    icon: 'forecast',
    permission: 'forecast:read',
  },
  {
    path: '/indicadores',
    label: 'Indicadores',
    hint: 'MAD y MAPE por ejecución',
    icon: 'indicators',
    permission: 'indicators:read',
  },
  {
    path: '/admin/usuarios',
    label: 'Usuarios',
    hint: 'Cuentas, roles y seguridad',
    icon: 'users',
    permission: 'users:manage',
  },
];

export function allowedModules(hasPermission) {
  return MODULES.filter((module) => hasPermission(module.permission));
}
