import { useEffect, useState } from 'react';

/**
 * Ejecuta una consulta al montar. `state.status`: 'loading' | 'ready' | 'not-implemented' | 'error'.
 * Un 403 access-denied lo atiende el manejador global (redirige a /sin-permiso).
 */
export default function useModuleQuery(request) {
  const [state, setState] = useState({ status: 'loading', data: null, error: null });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading', data: null, error: null });
    request()
      .then((data) => {
        if (!cancelled) setState({ status: 'ready', data, error: null });
      })
      .catch((error) => {
        if (cancelled) return;
        const status = error.code === 'not-implemented' ? 'not-implemented' : 'error';
        setState({ status, data: null, error });
      });
    return () => {
      cancelled = true;
    };
  }, [request]);

  return state;
}
