import { useCallback, useState } from 'react';
import { METHOD_ORDER } from '../../format';

const STORAGE_KEY = 'sierra-alta:colores-series';
const HEX = /^#[0-9a-f]{6}$/i;

/** Color inicial de cada serie: el real en tinta y cada método por su posición fija en METHOD_ORDER. */
export const DEFAULT_COLOR_VARS = {
  real: '--chart-actual',
  ...Object.fromEntries(METHOD_ORDER.map((method, i) => [method, `--chart-${i + 1}`])),
};

/**
 * Colores de las series que eligió quien está viendo (requisito del dashboard del Excel). Se recuerdan en
 * este navegador para todas las ejecuciones; sin almacenamiento disponible, se usan los iniciales.
 */
export default function useSeriesColors() {
  const [custom, setCustom] = useState(readStored);
  const colors = Object.fromEntries(
    Object.entries(DEFAULT_COLOR_VARS).map(([key, variable]) => [key, custom[key] ?? `var(${variable})`]),
  );
  const setColor = useCallback((key, hex) => {
    setCustom((current) => {
      const next = { ...current, [key]: hex };
      store(next);
      return next;
    });
  }, []);
  const resetColors = useCallback(() => {
    setCustom({});
    store({});
  }, []);
  return { colors, setColor, resetColors, isCustom: Object.keys(custom).length > 0 };
}

/** Valor "#rrggbb" para `<input type="color">`: el elegido o el de la variable CSS del color inicial. */
export function hexOf(color) {
  if (HEX.test(color)) return color;
  const variable = /^var\((--[\w-]+)\)$/.exec(color)?.[1];
  const value = variable ? getComputedStyle(document.documentElement).getPropertyValue(variable).trim() : '';
  return HEX.test(value) ? value : '#000000';
}

function readStored() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    return Object.fromEntries(
      Object.entries(parsed).filter(([key, value]) => key in DEFAULT_COLOR_VARS && HEX.test(value)),
    );
  } catch {
    return {};
  }
}

function store(colors) {
  try {
    if (Object.keys(colors).length === 0) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(colors));
  } catch {
    // Sin almacenamiento (modo privado o bloqueado): el color vale solo mientras la página esté abierta.
  }
}
