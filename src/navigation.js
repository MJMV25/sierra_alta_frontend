/** Secciones de la aplicación. El menú y el inicio se filtran por `permission`, nunca por nombre de rol. */
export const MODULES = [
  {
    path: '/historicos',
    label: 'Históricos',
    permission: 'history:read',
    description: 'Consulte las series históricas de producción por producto.',
  },
  {
    path: '/pronosticos',
    label: 'Pronósticos',
    permission: 'forecast:read',
    description: 'Consulte las ejecuciones de pronóstico y sus resultados.',
  },
  {
    path: '/indicadores',
    label: 'Indicadores',
    permission: 'indicators:read',
    description: 'Revise los indicadores de error (MAD y MAPE) de cada ejecución.',
  },
  {
    path: '/admin/usuarios',
    label: 'Usuarios',
    permission: 'users:manage',
    description: 'Cree cuentas, asigne roles, active o desactive usuarios y revise eventos de seguridad.',
  },
];

export function allowedModules(hasPermission) {
  return MODULES.filter((module) => hasPermission(module.permission));
}
