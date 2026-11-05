import { useState } from 'react';
import { uploadSeriesObservations } from '../../api/modules';
import ConfirmDialog from '../../components/ConfirmDialog';
import FormField from '../../components/FormField';
import ProblemAlert from '../../components/ProblemAlert';
import { formatPeriod } from '../../format';
import { lineOfField, parseObservations } from './parseObservations';

/**
 * Carga de meses nuevos para una serie (permiso history:write). El lote entra completo o se rechaza; como
 * los datos cargados no se pueden borrar desde el sistema, se pide confirmación antes de enviar.
 */
export default function UploadForm({ options, onLoaded }) {
  const [seriesId, setSeriesId] = useState('');
  const [text, setText] = useState('');
  const [errors, setErrors] = useState([]);
  const [problem, setProblem] = useState(null);
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);

  const selected = options.find((option) => String(option.seriesId) === seriesId);

  const handleSubmit = (event) => {
    event.preventDefault();
    setProblem(null);
    const parsed = parseObservations(text);
    const found = [...parsed.errors];
    if (!seriesId) found.unshift('Elija la referencia a la que pertenecen los datos.');
    if (parsed.errors.length === 0 && parsed.observations.length === 0) found.push('Escriba al menos un mes.');
    setErrors(found);
    if (found.length === 0) setPending(parsed.observations);
  };

  const confirm = async () => {
    setBusy(true);
    try {
      const loaded = await uploadSeriesObservations(
        seriesId,
        pending.map(({ period, value }) => ({ period, value })),
      );
      setText('');
      setErrors([]);
      onLoaded(loaded, selected);
    } catch (error) {
      if (error.code === 'validation') {
        setErrors(
          error.errors.map(({ field, message }) => {
            const line = lineOfField(field, pending);
            return line ? `Línea ${line}: ${message}` : message;
          }),
        );
      } else {
        setProblem(error);
      }
    } finally {
      setBusy(false);
      setPending(null);
    }
  };

  const months = (pending ?? []).map((observation) => observation.period).sort();

  return (
    <section className="panel" aria-labelledby="upload-title">
      <h2 className="panel__title" id="upload-title">
        Cargar históricos
      </h2>
      <p className="panel__text">
        Agregue los meses nuevos de una referencia. Si un mes no hubo producción, escriba 0. Todo el lote se
        acepta o se rechaza: no puede repetir meses ya cargados ni dejar meses sin dato.
      </p>
      <form className="form" onSubmit={handleSubmit} noValidate>
        <FormField
          id="upload-series"
          label="Referencia"
          value={seriesId}
          onChange={(event) => setSeriesId(event.target.value)}
        >
          <option value="">Elija una referencia…</option>
          {options.map((option) => (
            <option key={option.seriesId} value={option.seriesId}>
              {option.label}
            </option>
          ))}
        </FormField>
        <div className="field">
          <label className="field__label" htmlFor="upload-text">
            Meses y cantidades
          </label>
          <textarea
            id="upload-text"
            className={errors.length ? 'field__control field__control--invalid' : 'field__control'}
            rows={6}
            value={text}
            onChange={(event) => setText(event.target.value)}
            aria-describedby="upload-text-hint"
            aria-invalid={errors.length ? true : undefined}
            placeholder={'2026-10;155\n2026-11;162'}
          />
          <p className="field__hint" id="upload-text-hint">
            Un mes por línea: AAAA-MM y la cantidad, separados por punto y coma, espacio o tabulación (puede pegar dos
            columnas de Excel). {selected?.lastPeriod && `Último mes cargado: ${formatPeriod(selected.lastPeriod)}.`}
          </p>
        </div>
        {errors.length > 0 && (
          <div className="alert alert--error" role="alert">
            <ul className="alert__list">
              {errors.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </div>
        )}
        <ProblemAlert problem={problem} onDismiss={() => setProblem(null)} />
        <div>
          <button type="submit" className="btn btn--primary" disabled={busy}>
            Cargar históricos
          </button>
        </div>
      </form>

      <ConfirmDialog
        open={pending !== null}
        busy={busy}
        title="Confirmar carga"
        confirmLabel={busy ? 'Cargando…' : 'Cargar'}
        onConfirm={confirm}
        onCancel={() => setPending(null)}
      >
        <p>
          ¿Cargar <strong>{months.length}</strong> {months.length === 1 ? 'mes' : 'meses'} (
          {formatPeriod(months[0])}
          {months.length > 1 && ` a ${formatPeriod(months[months.length - 1])}`}) en{' '}
          <strong>{selected?.label}</strong>?
        </p>
        <p>Los meses cargados quedan registrados y no se pueden borrar desde el sistema.</p>
      </ConfirmDialog>
    </section>
  );
}
