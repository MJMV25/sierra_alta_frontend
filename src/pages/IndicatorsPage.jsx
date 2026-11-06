import { useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getExecutionIndicators, listForecasts } from '../api/modules';
import { useAuth } from '../auth/AuthProvider';
import QueryState from '../components/QueryState';
import ComparisonTable from './forecast/ComparisonTable';
import ExecutionsTable from './forecast/ExecutionsTable';
import useModuleQuery from './useModuleQuery';

/** Indicadores por ejecución: la elegida queda en la URL (?ejecucion=7) para poder compartirla. */
export default function IndicatorsPage() {
  const [params] = useSearchParams();
  const selectedId = Number(params.get('ejecucion')) || null;
  const executions = useModuleQuery(listForecasts);

  return (
    <div className="page">
      <header className="page__header">
        <h1 className="page__title">Indicadores</h1>
        <p className="page__subtitle">
          MAD y MAPE de cada método, el mejor por cada indicador y su estado frente al umbral de aceptación.
        </p>
      </header>
      {selectedId && <SelectedComparison executionId={selectedId} />}
      <section className="panel" aria-labelledby="executions-title">
        <h2 className="panel__title" id="executions-title">
          Elija una ejecución
        </h2>
        <QueryState query={executions}>
          {(data) => (
            <ExecutionsTable
              executions={data}
              selectedId={selectedId}
              linkLabel="Ver indicadores"
              linkTo={(id) => `/indicadores?ejecucion=${id}`}
            />
          )}
        </QueryState>
      </section>
    </div>
  );
}

function SelectedComparison({ executionId }) {
  const { hasPermission } = useAuth();
  const request = useCallback(() => getExecutionIndicators(executionId), [executionId]);
  const comparison = useModuleQuery(request);

  return (
    <section className="panel" aria-labelledby="comparison-title">
      <div className="panel__header">
        <h2 className="panel__title" id="comparison-title">
          Ejecución n.º {executionId}
        </h2>
        {hasPermission('forecast:read') && (
          <Link className="btn btn--small btn--ghost" to={`/pronosticos/${executionId}`}>
            Ver pronóstico completo
          </Link>
        )}
      </div>
      <QueryState query={comparison}>{(data) => <ComparisonTable comparison={data} />}</QueryState>
    </section>
  );
}
