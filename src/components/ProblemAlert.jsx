/** Muestra el `detail` de un problem+json tal como lo envía el backend. */
export default function ProblemAlert({ problem, onDismiss }) {
  if (!problem) return null;
  return (
    <div className="alert alert--error" role="alert">
      <p className="alert__text">{problem.detail}</p>
      {onDismiss && (
        <button type="button" className="alert__close" onClick={onDismiss} aria-label="Cerrar mensaje">
          ×
        </button>
      )}
    </div>
  );
}
