import { useCallback, useState } from 'react';
import { getExecutionIndicators } from '../api/modules';
import FormField from '../components/FormField';
import ModuleContent from './ModuleContent';
import useModuleQuery from './useModuleQuery';

export default function IndicatorsPage() {
  const [draft, setDraft] = useState('1');
  const [executionId, setExecutionId] = useState('1');
  const request = useCallback(() => getExecutionIndicators(executionId), [executionId]);
  const indicators = useModuleQuery(request);

  const handleSubmit = (event) => {
    event.preventDefault();
    setExecutionId(draft);
  };

  return (
    <div className="page">
      <header className="page__header">
        <h1 className="page__title">Indicadores</h1>
        <p className="page__subtitle">
          Indicadores de error (MAD y MAPE) calculados por el sistema para cada ejecución.
        </p>
      </header>
      <section className="panel" aria-labelledby="indicators-title">
        <h2 className="panel__title" id="indicators-title">
          Indicadores de la ejecución
        </h2>
        <form className="form form--inline" onSubmit={handleSubmit}>
          <FormField
            id="execution-id"
            label="Ejecución"
            type="number"
            min="1"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            required
          />
          <button type="submit" className="btn btn--primary" disabled={!draft}>
            Consultar
          </button>
        </form>
        <ModuleContent state={indicators} emptyLabel="No hay indicadores para esta ejecución." />
      </section>
    </div>
  );
}
