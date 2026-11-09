import { listForecasts, listProducts } from '../../api/modules';
import { useAuth } from '../../auth/AuthProvider';
import QueryState from '../../components/QueryState';
import { seriesOptions } from '../seriesOptions';
import useModuleQuery from '../useModuleQuery';
import ExecutionsTable from './ExecutionsTable';
import ForecastForm from './ForecastForm';

export default function ForecastPage() {
  const { hasPermission } = useAuth();
  const executions = useModuleQuery(listForecasts);

  return (
    <div className="page">
      <header className="page__header">
        <h1 className="page__title">Pronósticos</h1>
        <p className="page__subtitle">Pronóstico del periodo siguiente con cinco métodos, comparados por MAD y MAPE.</p>
      </header>
      {hasPermission('forecast:execute') && <NewForecast />}
      <section className="panel" aria-labelledby="executions-title">
        <h2 className="panel__title" id="executions-title">
          Ejecuciones recientes
        </h2>
        <QueryState query={executions}>
          {(data) => <ExecutionsTable executions={data} linkTo={(id) => `/pronosticos/${id}`} />}
        </QueryState>
      </section>
    </div>
  );
}

function NewForecast() {
  const products = useModuleQuery(listProducts);
  return <QueryState query={products}>{(data) => <ForecastForm options={seriesOptions(data)} />}</QueryState>;
}
