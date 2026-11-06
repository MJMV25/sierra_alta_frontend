import { Link } from 'react-router-dom';
import { formatDateTime, formatPeriod, METHOD_LABELS, METHOD_SHORT_LABELS } from '../../format';

/** Últimas ejecuciones. `linkTo(id)` arma el enlace de cada fila; `selectedId` resalta una. */
export default function ExecutionsTable({ executions, linkTo, linkLabel = 'Ver', selectedId = null }) {
  if (executions.length === 0) return <p>Aún no hay ejecuciones de pronóstico.</p>;
  return (
    <div className="table-wrap">
      <table className="table table--sticky table--cards">
        <caption className="visually-hidden">Ejecuciones de pronóstico, de la más reciente a la más antigua</caption>
        <thead>
          <tr>
            <th scope="col">N.º</th>
            <th scope="col">Fecha</th>
            <th scope="col">Referencia</th>
            <th scope="col">Métodos</th>
            <th scope="col">Evaluado desde</th>
            <th scope="col" className="table__number">
              Versión de datos
            </th>
            <th scope="col">
              <span className="visually-hidden">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {executions.map((execution) => (
            <tr key={execution.id} className={execution.id === selectedId ? 'table__row--selected' : undefined}>
              <th scope="row" className="table__strong">
                <span className="table__card-only">Ejecución n.º </span>
                {execution.id}
              </th>
              <td className="table__muted" data-label="Fecha">{formatDateTime(execution.executedAt)}</td>
              <td data-label="Referencia">{execution.productName ?? '—'}</td>
              <td data-label="Métodos" title={execution.methods.map((method) => METHOD_LABELS[method] ?? method).join(', ')}>
                {execution.methods.map((method) => METHOD_SHORT_LABELS[method] ?? method).join(' · ')}
              </td>
              <td data-label="Evaluado desde">{formatPeriod(execution.evaluationStart)}</td>
              <td className="table__number" data-label="Versión de datos">
                {execution.dataVersion}
              </td>
              <td className="table__actions">
                <Link
                  className="btn btn--small btn--ghost"
                  to={linkTo(execution.id)}
                  aria-label={`${linkLabel} ejecución ${execution.id}`}
                >
                  {linkLabel}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
