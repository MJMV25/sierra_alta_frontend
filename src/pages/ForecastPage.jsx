import { useState } from 'react';
import { executeForecast, listForecasts } from '../api/modules';
import { useAuth } from '../auth/AuthProvider';
import ModuleContent, { ActionResult } from './ModuleContent';
import useModuleQuery from './useModuleQuery';

export default function ForecastPage() {
  const { hasPermission } = useAuth();
  const executions = useModuleQuery(listForecasts);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const handleExecute = async () => {
    setBusy(true);
    setResult(null);
    try {
      await executeForecast();
      setResult({ message: 'Pronóstico ejecutado.' });
    } catch (error) {
      setResult({ error });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <header className="page__header page__header--row">
        <div>
          <h1 className="page__title">Pronósticos</h1>
          <p className="page__subtitle">Ejecuciones de pronóstico de producción.</p>
        </div>
        {hasPermission('forecast:execute') && (
          <button type="button" className="btn btn--primary" onClick={handleExecute} disabled={busy}>
            {busy ? 'Ejecutando…' : 'Ejecutar pronóstico'}
          </button>
        )}
      </header>
      <ActionResult result={result} />
      <section className="panel" aria-labelledby="executions-title">
        <h2 className="panel__title" id="executions-title">
          Ejecuciones
        </h2>
        <ModuleContent state={executions} emptyLabel="Aún no hay ejecuciones de pronóstico." />
      </section>
    </div>
  );
}
