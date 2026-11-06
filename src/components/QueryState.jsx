import LoadingState from './LoadingState';
import ProblemAlert from './ProblemAlert';

/** Carga o error de una consulta de useModuleQuery; con datos listos muestra `children`. */
export default function QueryState({ query, children }) {
  if (query.status === 'loading' && query.data === null) return <LoadingState />;
  if (query.status === 'error') {
    return (
      <div className="stack">
        <ProblemAlert problem={query.error} />
        <button type="button" className="btn btn--ghost" onClick={query.reload}>
          Reintentar
        </button>
      </div>
    );
  }
  return children(query.data);
}
