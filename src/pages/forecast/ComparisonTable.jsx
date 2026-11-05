import { formatNumber, formatPercent, formatPeriod, formatParameters, METHOD_LABELS, STATUS_LABELS } from '../../format';

/**
 * Tabla comparativa de una ejecución (GET /indicators/executions/{id}). Ni el MAD ni el MAPE mandan: se
 * marca el menor de cada uno por separado (ADR 07). Con `detail` (la ejecución completa) agrega los
 * parámetros y el pronóstico del mes siguiente de cada método.
 */
export default function ComparisonTable({ comparison, detail = null, unit = '' }) {
  const methodOf = (code) => detail?.methods.find((m) => m.method === code);
  const nextPeriod = detail?.methods[0]?.nextForecast?.period;
  const threshold = comparison.mapeThresholdPercent;

  return (
    <>
      <p className="panel__text">
        {comparison.evaluationFrom
          ? `Evaluado de ${formatPeriod(comparison.evaluationFrom)} a ${formatPeriod(comparison.evaluationTo)}, los mismos meses para todos los métodos.`
          : 'Ningún mes tuvo pronóstico de todos los métodos: MAD y MAPE no son calculables.'}{' '}
        {threshold === null
          ? 'Esta ejecución es anterior al umbral de aceptación: sin criterio definido.'
          : `Un método cumple si su MAPE es menor que ${formatPercent(threshold)}.`}
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
                  Pronóstico {formatPeriod(nextPeriod)}
                </th>
              )}
              <th scope="col" className="table__number">
                MAD{unit && ` (${unit})`}
              </th>
              <th scope="col" className="table__number">
                MAPE
              </th>
              <th scope="col">Estado</th>
            </tr>
          </thead>
          <tbody>
            {comparison.methods.map((row) => {
              const status = STATUS_LABELS[row.status] ?? { label: row.status, tone: 'off', icon: '' };
              const method = methodOf(row.method);
              return (
                <tr key={row.method}>
                  <th scope="row" className="table__strong">
                    {METHOD_LABELS[row.method] ?? row.method}
                  </th>
                  {detail && (
                    <td className="table__muted" data-label="Parámetros">
                      {method ? formatParameters(method) : '—'}
                    </td>
                  )}
                  {nextPeriod && (
                    <td className="table__number" data-label={`Pronóstico ${formatPeriod(nextPeriod)}`}>
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
                  <td data-label="Estado">
                    <span className={`badge badge--${status.tone}`}>
                      <span aria-hidden="true">{status.icon}</span> {status.label}
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
    notes.push('El MAD de cada método depende de los meses evaluados, que cambian según los métodos que se ejecuten juntos.');
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
