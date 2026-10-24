import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as authApi from '../api/auth';
import { setAuthHandlers } from '../api/http';

export const SESSION_ENDED_MESSAGE = 'Su sesión terminó. Inicie sesión de nuevo.';

const AuthContext = createContext(null);

/**
 * Estado de la sesión en el cliente. Solo decide qué se muestra: la autorización real la hace el backend.
 * status: 'loading' mientras se consulta /api/v1/auth/me, luego 'authenticated' o 'anonymous'.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading');
  // Aviso para el login (p. ej. sesión expirada). Se guarda aquí y no en location.state porque
  // RequireAuth también redirige al detectar la sesión vacía y reemplazaría ese estado.
  const [notice, setNotice] = useState(null);
  const navigate = useNavigate();

  const clearSession = useCallback(() => {
    setUser(null);
    setStatus('anonymous');
  }, []);

  const endSession = useCallback(() => {
    clearSession();
    setNotice(SESSION_ENDED_MESSAGE);
    navigate('/login', { replace: true });
  }, [clearSession, navigate]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await authApi.fetchCsrfToken().catch(() => {});
      try {
        const session = await authApi.getSession();
        if (!cancelled) {
          setUser(session);
          setStatus('authenticated');
        }
      } catch {
        if (!cancelled) clearSession();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clearSession]);

  useEffect(
    () =>
      setAuthHandlers({
        onUnauthorized: endSession,
        // El rol pudo cambiar en el servidor: se refrescan los permisos antes de mostrar /sin-permiso.
        onForbidden: async () => {
          try {
            setUser(await authApi.getSession());
            navigate('/sin-permiso', { replace: true });
          } catch {
            endSession();
          }
        },
      }),
    [endSession, navigate],
  );

  const login = useCallback(async (username, password) => {
    const session = await authApi.login(username, password);
    setUser(session);
    setStatus('authenticated');
    setNotice(null);
    return session;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Aunque falle la red, la sesión local se limpia; el servidor la expira por inactividad.
    } finally {
      clearSession();
      navigate('/login', { replace: true });
    }
  }, [clearSession, navigate]);

  const value = useMemo(() => {
    const permissions = user?.permissions ?? [];
    return {
      user,
      status,
      notice,
      permissions,
      hasPermission: (permission) => permissions.includes(permission),
      login,
      logout,
    };
  }, [user, status, notice, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de <AuthProvider>.');
  return context;
}
