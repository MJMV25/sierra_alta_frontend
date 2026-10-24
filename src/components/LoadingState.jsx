export default function LoadingState({ label = 'Cargando…', fullScreen = false }) {
  return (
    <div className={fullScreen ? 'loading loading--full' : 'loading'} role="status" aria-live="polite">
      <span className="loading__spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
