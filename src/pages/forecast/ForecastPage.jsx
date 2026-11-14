import { listForecasts } from '../../api/modules';
import QueryState from '../../components/QueryState';
import useModuleQuery from '../useModuleQuery';
import ExecutionsTable from './ExecutionsTable';

/** Pronósticos guardados desde la hoja de datos, con sus parámetros y los datos que usaron. */
export default function ForecastPage() {
  const executions = useModuleQuery(listForecasts);

  return (
    <div className="page">
      <header className="page__header">
        <h1 className="page__title">Pronósticos guardados</h1>
        <p className="page__subtitle">
          Cada uno conserva el método, los parámetros, los datos con que se calculó y quién lo guardó. Para calcular uno
          nuevo, use la hoja de datos.
        </p>
      </header>
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
