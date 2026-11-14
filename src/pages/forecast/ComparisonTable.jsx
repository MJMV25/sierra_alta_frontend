import { formatNumber, formatPercent, formatPeriod, formatParameters, METHOD_LABELS, periodWord } from '../../format';

/** Orden de las filas: el de los métodos, o de menor a mayor MAD o MAPE (los no calculables al final). */
export const SORT_OPTIONS = { method: 'Orden de los métodos', mad: 'Menor MAD primero', mape: 'Menor MAPE primero' };

export function sortRows(rows, sortBy) {
  if (sortBy === 'method') return rows;
  const key = sortBy === 'mad' ? 'mad' : 'mapePercent';
  const value = (row) => (row[key] === null || row[key] === undefined ? Infinity : Number(row[key]));
  return [...rows].sort((a, b) => value(a) - value(b));
}

/**
 * Tabla comparativa de una ejecución (guardada o recalculada en vivo). Se marca el menor MAD y el menor MAPE
 * por separado; el estacional multiplicativo aparece pero no compite (ADR 13 del backend). Con `detail` (la ejecución completa) agrega los
 * parámetros y el pronóstico del mes siguiente de cada método. `sortBy` ordena las filas (SORT_OPTIONS).
 */
export default function ComparisonTable({ comparison, detail = null, unit = '', sortBy = 'method', periodicity: given }) {
  const methodOf = (code) => detail?.methods.find((m) => m.method === code);
  const nextPeriod = detail?.methods[0]?.nextForecast?.period;
  // Del detalle o, en la pantalla Indicadores, de la fila de la ejecución (casos de prueba: "t = n").
  const periodicity = detail?.periodicity ?? given;

  return (
    <>
      <p className="panel__text">
        {comparison.evaluationFrom
          ? `Evaluado de ${formatPeriod(comparison.evaluationFrom, periodicity)} a ${formatPeriod(comparison.evaluationTo, periodicity)}, los mismos ${periodWord(2, periodicity)} para todos los métodos.`
          : 'Ningún mes tuvo pronóstico de todos los métodos: MAD y MAPE no son calculables.'}
      </p>
      <div className="table-wrap">
        <table className="table table--sticky table--cards">
          <caption className="visually-hidden">Comparación de métodos por MAD y MAPE</caption>
          <thead>
            <tr>
              <th scope="col">Método</th>
              {detail && <th scope="col">Parámetros</th>}
              {nextPeriod && (
                <th scope="col" className="table__number">
                  Pronóstico {formatPeriod(nextPeriod, periodicity)}
                </th>
              )}
              <th scope="col" className="table__number">
                MAD{unit && ` (${unit})`}
              </th>
              <th scope="col" className="table__number">
                MAPE
              </th>
            </tr>
          </thead>
          <tbody>
            {sortRows(comparison.methods, sortBy).map((row) => {
              const method = methodOf(row.method);
              return (
                <tr key={row.method}>
                  <th scope="row" className="table__strong">
                    {METHOD_LABELS[row.method] ?? row.method}
                    {row.comparable === false && <span className="tag tag--muted">No compite</span>}
                  </th>
                  {detail && (
                    <td className="table__muted" data-label="Parámetros">
                      {method ? formatParameters(method) : '—'}
                    </td>
                  )}
                  {nextPeriod && (
                    <td className="table__number" data-label={`Pronóstico ${formatPeriod(nextPeriod, periodicity)}`}>
                      {formatNumber(method?.nextForecast?.forecast)}
                    </td>
                  )}
                  <td className="table__number" data-label={`MAD${unit ? ` (${unit})` : ''}`}>
                    <span>
                      {row.mad === null ? 'No calculable' : formatNumber(row.mad)}
                      {row.bestByMad && <span className="tag tag--best">Menor MAD</span>}
                    </span>
                  </td>
                  <td className="table__number" data-label="MAPE">
                    <span>
                      {formatPercent(row.mapePercent)}
                      {row.bestByMape && <span className="tag tag--best">Menor MAPE</span>}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Warnings comparison={comparison} />
    </>
  );
}

const zeroMonths = (count) =>
  `${count} ${count === 1 ? 'mes' : 'meses'} con producción 0 no ${count === 1 ? 'entra' : 'entran'} al MAPE (sí al MAD).`;

function Warnings({ comparison }) {
  const excluded = comparison.methods.filter((row) => row.mapeExcluded > 0);
  const sameForAll =
    comparison.methods.length > 1 &&
    excluded.length === comparison.methods.length &&
    excluded.every((row) => row.mapeExcluded === excluded[0].mapeExcluded);
  const notes = sameForAll
    ? [`En todos los métodos, ${zeroMonths(excluded[0].mapeExcluded)}`]
    : excluded.map((row) => `${METHOD_LABELS[row.method] ?? row.method}: ${zeroMonths(row.mapeExcluded)}`);
  if (comparison.methods.length > 1) {
    notes.push('El MAD de cada método depende de los periodos evaluados, que cambian según los métodos que se ejecuten juntos.');
  }
  if (notes.length === 0) return null;
  return (
    <ul className="notes">
      {notes.map((note) => (
        <li key={note}>{note}</li>
      ))}
    </ul>
  );
}
