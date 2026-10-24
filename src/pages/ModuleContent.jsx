import LoadingState from '../components/LoadingState';
import ProblemAlert from '../components/ProblemAlert';
import UnderConstruction from '../components/UnderConstruction';

/** Estado común de los módulos cuyo backend aún no está implementado. */
export default function ModuleContent({ state, emptyLabel }) {
  if (state.status === 'loading') return <LoadingState />;
  if (state.status === 'not-implemented') return <UnderConstruction />;
  if (state.status === 'error') return <ProblemAlert problem={state.error} />;
  const count = Array.isArray(state.data) ? state.data.length : 1;
  if (count === 0) return <p>{emptyLabel}</p>;
  return <p>Se recibieron {count} registro(s).</p>;
}

/** Resultado de una acción (botón) sobre un módulo: un 501 se muestra como "en construcción". */
export function ActionResult({ result }) {
  if (!result) return null;
  if (result.error?.code === 'not-implemented') return <UnderConstruction />;
  if (result.error) return <ProblemAlert problem={result.error} />;
  return (
    <div className="alert alert--success" role="status">
      <p className="alert__text">{result.message}</p>
    </div>
  );
}
