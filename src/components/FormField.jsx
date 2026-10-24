/**
 * Campo con etiqueta y mensaje de error asociado (aria-describedby / aria-invalid).
 * Con `children` se renderiza un <select> con esas opciones; si no, un <input>.
 */
export default function FormField({ id, label, error, hint, children, ...controlProps }) {
  const errorId = error ? `${id}-error` : undefined;
  const hintId = hint ? `${id}-hint` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  const common = {
    id,
    name: controlProps.name ?? id,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy,
    className: error ? 'field__control field__control--invalid' : 'field__control',
    ...controlProps,
  };

  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      {children ? <select {...common}>{children}</select> : <input {...common} />}
      {hint && (
        <p className="field__hint" id={hintId}>
          {hint}
        </p>
      )}
      {error && (
        <p className="field__error" id={errorId}>
          {error}
        </p>
      )}
    </div>
  );
}

/** Convierte `errors: [{ field, message }]` de un problem+json de validación en { campo: mensaje }. */
export function fieldErrorsFrom(apiError) {
  if (apiError?.code !== 'validation') return {};
  return (apiError.errors ?? []).reduce((acc, { field, message }) => {
    acc[field] = acc[field] ? `${acc[field]} ${message}` : message;
    return acc;
  }, {});
}
