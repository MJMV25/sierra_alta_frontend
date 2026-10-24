import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthProvider';

/** Oculta rutas que el rol no puede usar. El backend vuelve a validar cada solicitud. */
export default function RequirePermission({ permission, children }) {
  const { hasPermission } = useAuth();
  if (!hasPermission(permission)) return <Navigate to="/sin-permiso" replace />;
  return children ?? <Outlet />;
}
