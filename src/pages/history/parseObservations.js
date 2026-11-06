const PERIOD = /^(19|20)\d{2}-(0[1-9]|1[0-2])$/;
const NUMBER = /^\d+(\.\d+)?$/;

/**
 * Convierte el texto pegado (una línea por mes: "2026-10;155", "2026-10 155" o dos columnas copiadas de
 * Excel) en `[{ period, value }]`. El decimal puede ir con punto o coma; no se aceptan separadores de miles.
 * Devuelve `{ observations, errors }`; `errors` trae un mensaje por línea inválida (líneas desde 1).
 * Solo revisa el formato: meses repetidos, huecos o futuros los valida el backend.
 */
export function parseObservations(text) {
  const observations = [];
  const errors = [];
  text.split(/\r?\n/).forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line) return;
    let parts = line.split(/[\t;]|\s+/).filter(Boolean);
    if (parts.length === 1) parts = line.split(',');
    const lineNumber = index + 1;
    if (parts.length !== 2) {
      errors.push(`Línea ${lineNumber}: escriba el mes y la cantidad, por ejemplo 2026-10;155.`);
      return;
    }
    const [period, rawValue] = parts.map((part) => part.trim());
    const value = rawValue.includes('.') ? rawValue : rawValue.replace(',', '.');
    if (!PERIOD.test(period)) {
      errors.push(`Línea ${lineNumber}: "${period}" no es un mes válido; use AAAA-MM, por ejemplo 2026-10.`);
    } else if (!NUMBER.test(value)) {
      errors.push(`Línea ${lineNumber}: "${rawValue}" no es una cantidad válida (número ≥ 0, sin separador de miles).`);
    } else {
      observations.push({ period, value: Number(value), line: lineNumber });
    }
  });
  return { observations, errors };
}

/** Traduce `observations[3].value` del backend a la línea del texto donde estaba ese mes. */
export function lineOfField(field, observations) {
  const match = /^observations\[(\d+)\]/.exec(field ?? '');
  return match ? observations[Number(match[1])]?.line : undefined;
}
