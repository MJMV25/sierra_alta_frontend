import { useEffect, useRef, useState } from 'react';
import { previewForecast } from '../../api/modules';
import { enabledMethods, errorsByMethod, localErrors, toRequest } from '../forecast/methodConfig';

/** Espera tras la última tecla antes de recalcular: suficiente para no pedir un cálculo por cada dígito. */
export const PREVIEW_DELAY_MS = 350;

/**
 * Recalcula en vivo, como el Excel: cada cambio de parámetros, periodo o datos pide al backend un cálculo sin
 * guardar (POST /forecasts/preview). Mientras llega la respuesta se conserva el resultado anterior; si el
 * usuario sigue escribiendo, la solicitud anterior se cancela.
 *
 * `actuals`: datos sin guardar (o null para usar los guardados). Devuelve
 * { data, loading, fieldErrors, problem }.
 */
export default function useLivePreview({ seriesId, config, from, to, actuals }) {
  const [state, setState] = useState({ data: null, loading: false, fieldErrors: {}, problem: null });
  const lastSeries = useRef(seriesId);
  const local = localErrors(config);
  const blocked = Object.keys(local).length > 0;
  const key = JSON.stringify({ seriesId, config, from, to, actuals });

  useEffect(() => {
    if (lastSeries.current !== seriesId) {
      lastSeries.current = seriesId;
      setState({ data: null, loading: false, fieldErrors: {}, problem: null });
    }
    if (!seriesId || blocked) {
      setState((current) => ({ ...current, loading: false }));
      return undefined;
    }
    const controller = new AbortController();
    setState((current) => ({ ...current, loading: true }));
    const timer = setTimeout(async () => {
      const chosen = enabledMethods(config);
      try {
        const data = await previewForecast(
          { seriesId, from, to, methods: chosen.map((method) => toRequest(method, config[method])), actuals: actuals ?? undefined },
          controller.signal,
        );
        setState({ data, loading: false, fieldErrors: {}, problem: null });
      } catch (error) {
        if (controller.signal.aborted) return;
        setState((current) => ({
          ...current,
          loading: false,
          fieldErrors: error.code === 'validation' ? errorsByMethod(error.errors, chosen) : {},
          problem: error.code === 'validation' ? generalProblem(error.errors) : error,
        }));
      }
    }, PREVIEW_DELAY_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // `key` resume todas las entradas: evita recalcular por objetos nuevos con el mismo contenido.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, blocked]);

  return {
    ...state,
    fieldErrors: blocked ? local : state.fieldErrors,
    blocked,
  };
}

/**
 * Errores que no son de un parámetro (p. ej. datos sin guardar con huecos, o el periodo elegido): se muestran
 * como aviso general; los de cada parámetro van junto a su casilla.
 */
function generalProblem(errors = []) {
  const general = errors.filter(({ field }) => !/^methods\[/.test(field ?? ''));
  return general.length === 0 ? null : { detail: general.map(({ message }) => message).join(' ') };
}
