import { useCallback } from 'react';
import { getSeriesChanges } from '../../api/modules';
import QueryState from '../../components/QueryState';
import { formatDateTime, formatNumber, formatPeriod } from '../../format';
import useModuleQuery from '../useModuleQuery';

/** Historial de cambios de la hoja de una referencia: quién cambió qué mes, de cuánto a cuánto y cuándo. */
export default function ChangeHistory({ seriesId, periodicity, version }) {
  // `version` cambia al guardar: vuelve a consultar el historial.
  const request = useCallback(() => getSeriesChanges(seriesId), [seriesId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const changes = useModuleQuery(request);
  return (
    <QueryState query={changes}>
      {(data) =>
        data.length === 0 ? (
          <p className="panel__text">Esta referencia todavía no tiene cambios registrados.</p>
        ) : (
          <div className="table-wrap table-wrap--scroll table-wrap--short">
            <table className="table table--compact table--sticky">
              <caption className="visually-hidden">Historial de cambios</caption>
              <thead>
                <tr>
                  <th scope="col">Fecha</th>
                  <th scope="col">Usuario</th>
                  <th scope="col">Mes</th>
                  <th scope="col">Cambio</th>
                </tr>
              </thead>
              <tbody>
                {data.map((change) => (
                  <tr key={`${change.loadId}-${change.period}`}>
                    <td>{formatDateTime(change.changedAt)}</td>
                    <td>{change.changedBy ?? '—'}</td>
                    <th scope="row">{formatPeriod(change.period, periodicity)}</th>
                    <td>{describe(change)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }
    </QueryState>
  );
}

function describe({ previousValue, newValue }) {
  if (previousValue === null) return `Agregado: ${formatNumber(newValue)}`;
  if (newValue === null) return `Borrado (era ${formatNumber(previousValue)})`;
  return `${formatNumber(previousValue)} → ${formatNumber(newValue)}`;
}
