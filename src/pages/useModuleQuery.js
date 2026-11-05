import { useCallback, useEffect, useState } from 'react';

/**
 * Ejecuta una consulta al montar y cada vez que cambia `request` (memorícela con useCallback).
 * `state.status`: 'loading' | 'ready' | 'error'. `reload()` repite la consulta.
 * Un 403 access-denied lo atiende el manejador global (redirige a /sin-permiso).
 */
export default function useModuleQuery(request) {
  const [state, setState] = useState({ status: 'loading', data: null, error: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState((current) => ({ ...current, status: 'loading', error: null }));
    request()
      .then((data) => {
        if (!cancelled) setState({ status: 'ready', data, error: null });
      })
      .catch((error) => {
        if (!cancelled) setState({ status: 'error', data: null, error });
      });
    return () => {
      cancelled = true;
    };
  }, [request, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, reload };
}
