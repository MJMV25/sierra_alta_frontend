export default function Notice({ tone = 'info', children, onDismiss }) {
  return (
    <div className={`alert alert--${tone}`} role="status">
      <p className="alert__text">{children}</p>
      {onDismiss && (
        <button type="button" className="alert__close" onClick={onDismiss} aria-label="Cerrar mensaje">
          ×
        </button>
      )}
    </div>
  );
}
