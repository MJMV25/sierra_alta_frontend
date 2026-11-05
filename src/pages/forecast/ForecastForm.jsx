import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { executeForecast } from '../../api/modules';
import FormField from '../../components/FormField';
import ProblemAlert from '../../components/ProblemAlert';
import { formatNumber, formatPeriod, METHOD_LABELS, METHOD_ORDER } from '../../format';

const MAX_WEIGHTS = 12;

const INITIAL = {
  SIMPLE_MOVING_AVERAGE: { enabled: true, periods: '3' },
  WEIGHTED_MOVING_AVERAGE: { enabled: true, weights: ['0,5', '0,3', '0,2'] },
  EXPONENTIAL_SMOOTHING: { enabled: true, alpha: '0,3' },
  TREND_ADJUSTED_EXPONENTIAL_SMOOTHING: { enabled: true, alpha: '0,3', beta: '0,1' },
};

/** "0,3" o "0.3" → 0.3; vacío o inválido → NaN (el backend responde el error del campo). */
export function parseDecimal(text) {
  const value = String(text).trim().replace(',', '.');
  return /^-?\d+(\.\d+)?$/.test(value) ? Number(value) : Number.NaN;
}

function toRequest(method, config) {
  if (method === 'SIMPLE_MOVING_AVERAGE') return { method, periods: parseDecimal(config.periods) };
  if (method === 'WEIGHTED_MOVING_AVERAGE') return { method, weights: config.weights.map(parseDecimal) };
  if (method === 'EXPONENTIAL_SMOOTHING') return { method, alpha: parseDecimal(config.alpha) };
  return { method, alpha: parseDecimal(config.alpha), beta: parseDecimal(config.beta) };
}

/**
 * Ejecuta de 1 a 4 métodos sobre una referencia. Los rangos (α y β entre 0 y 1, pesos que suman 1, n
 * menor o igual a los meses cargados) los valida el backend y sus errores se muestran junto a cada campo.
 */
export default function ForecastForm({ options }) {
  const navigate = useNavigate();
  const available = options.filter((option) => option.observations > 0);
  const [seriesId, setSeriesId] = useState(available.length === 1 ? String(available[0].seriesId) : '');
  const [range, setRange] = useState(() => fullRange(available.length === 1 ? available[0] : null));
  const [config, setConfig] = useState(INITIAL);
  const [fieldErrors, setFieldErrors] = useState({});
  const [problem, setProblem] = useState(null);
  const [busy, setBusy] = useState(false);

  const selected = available.find((option) => String(option.seriesId) === seriesId);
  const months = selected ? monthsBetween(selected.firstPeriod, selected.lastPeriod) : [];
  const usedMonths = range.from && range.to && range.from <= range.to ? monthsBetween(range.from, range.to).length : 0;

  const chooseSeries = (value) => {
    setSeriesId(value);
    setRange(fullRange(available.find((option) => String(option.seriesId) === value)));
  };
  const update = (method, changes) => setConfig((current) => ({ ...current, [method]: { ...current[method], ...changes } }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setProblem(null);
    const chosen = METHOD_ORDER.filter((method) => config[method].enabled);
    const errors = {};
    if (!seriesId) errors.seriesId = 'Elija la referencia que quiere pronosticar.';
    if (chosen.length === 0) errors.methods = 'Elija al menos un método.';
    if (seriesId && range.from > range.to) errors.to = 'El mes final no puede ser anterior al inicial.';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setBusy(true);
    try {
      const created = await executeForecast(
        { seriesId: Number(seriesId), from: range.from, to: range.to, methods: chosen.map((method) => toRequest(method, config[method])) },
        crypto.randomUUID(),
      );
      navigate(`/pronosticos/${created.id}`);
    } catch (error) {
      if (error.code === 'validation') {
        setFieldErrors(errorsByMethod(error.errors, chosen));
      } else {
        setProblem(error);
      }
      setBusy(false);
    }
  };

  const errorFor = (method, field) => fieldErrors[`${method}.${field}`];

  return (
    <section className="panel" aria-labelledby="execute-title">
      <h2 className="panel__title" id="execute-title">
        Nuevo pronóstico
      </h2>
      <form className="form" onSubmit={handleSubmit} noValidate>
        <FormField
          id="forecast-series"
          label="Referencia"
          value={seriesId}
          error={fieldErrors.seriesId}
          hint={
            selected &&
            `${selected.observations} meses cargados, de ${formatPeriod(selected.firstPeriod)} a ${formatPeriod(selected.lastPeriod)}.`
          }
          onChange={(event) => chooseSeries(event.target.value)}
        >
          <option value="">Elija una referencia…</option>
          {available.map((option) => (
            <option key={option.seriesId} value={option.seriesId}>
              {option.label}
            </option>
          ))}
        </FormField>

        {selected && (
          <fieldset className="period">
            <legend className="field__label">Periodo histórico</legend>
            <div className="period__fields">
              <FormField
                id="forecast-from"
                label="Desde"
                value={range.from}
                error={fieldErrors.from}
                onChange={(event) => setRange((current) => ({ ...current, from: event.target.value }))}
              >
                {months.map((month) => (
                  <option key={month} value={month}>
                    {formatPeriod(month)}
                  </option>
                ))}
              </FormField>
              <FormField
                id="forecast-to"
                label="Hasta"
                value={range.to}
                error={fieldErrors.to}
                onChange={(event) => setRange((current) => ({ ...current, to: event.target.value }))}
              >
                {months.map((month) => (
                  <option key={month} value={month}>
                    {formatPeriod(month)}
                  </option>
                ))}
              </FormField>
            </div>
            <p className="field__hint">
              {usedMonths > 0
                ? `Se usan ${usedMonths} ${usedMonths === 1 ? 'mes' : 'meses'} y se pronostica ${formatPeriod(nextPeriod(range.to))}.`
                : 'Elija un mes inicial anterior o igual al final.'}{' '}
              {(range.from !== selected.firstPeriod || range.to !== selected.lastPeriod) && (
                <button type="button" className="link-button" onClick={() => setRange(fullRange(selected))}>
                  Usar toda la serie
                </button>
              )}
            </p>
          </fieldset>
        )}

        <fieldset className="methods" aria-describedby={fieldErrors.methods ? 'methods-error' : undefined}>
          <legend className="field__label">Métodos a comparar</legend>
          {fieldErrors.methods && (
            <p className="field__error" id="methods-error">
              {fieldErrors.methods}
            </p>
          )}
          {METHOD_ORDER.map((method) => (
            <div key={method} className={config[method].enabled ? 'method' : 'method method--off'}>
              <label className="method__toggle">
                <input
                  type="checkbox"
                  checked={config[method].enabled}
                  onChange={(event) => update(method, { enabled: event.target.checked })}
                />
                {METHOD_LABELS[method]}
              </label>
              {errorFor(method, 'method') && <p className="field__error">{errorFor(method, 'method')}</p>}
              {config[method].enabled && (
                <MethodParameters
                  method={method}
                  config={config[method]}
                  errorFor={(field) => errorFor(method, field)}
                  onChange={(changes) => update(method, changes)}
                />
              )}
            </div>
          ))}
        </fieldset>

        <ProblemAlert problem={problem} onDismiss={() => setProblem(null)} />
        <div>
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? 'Ejecutando…' : 'Ejecutar pronóstico'}
          </button>
        </div>
      </form>
    </section>
  );
}

function MethodParameters({ method, config, errorFor, onChange }) {
  const id = (field) => `${method}-${field}`;
  if (method === 'SIMPLE_MOVING_AVERAGE') {
    return (
      <div className="method__params">
        <FormField
          id={id('periods')}
          label="Meses a promediar (n)"
          inputMode="numeric"
          value={config.periods}
          error={errorFor('periods')}
          onChange={(event) => onChange({ periods: event.target.value })}
        />
      </div>
    );
  }
  if (method === 'WEIGHTED_MOVING_AVERAGE') {
    const sum = config.weights.map(parseDecimal).reduce((total, w) => total + (Number.isNaN(w) ? 0 : w), 0);
    const setWeight = (index, value) => onChange({ weights: config.weights.map((w, i) => (i === index ? value : w)) });
    const resize = (count) =>
      onChange({ weights: Array.from({ length: count }, (_, i) => config.weights[i] ?? '') });
    return (
      <div className="method__params">
        <FormField
          id={id('count')}
          label="Cantidad de pesos"
          value={String(config.weights.length)}
          onChange={(event) => resize(Number(event.target.value))}
        >
          {Array.from({ length: MAX_WEIGHTS }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              {i + 1}
            </option>
          ))}
        </FormField>
        {config.weights.map((weight, index) => (
          <FormField
            key={index}
            id={id(`weight-${index}`)}
            label={index === 0 ? 'Peso K0 (mes más reciente)' : `Peso K${index}`}
            inputMode="decimal"
            value={weight}
            error={errorFor(`weights[${index}]`)}
            onChange={(event) => setWeight(index, event.target.value)}
          />
        ))}
        <p className={errorFor('weights') ? 'field__error method__note' : 'field__hint method__note'}>
          {errorFor('weights') ?? `Suma actual: ${formatNumber(sum)} (debe ser 1). K0 es el peso del mes más reciente, como en el Excel.`}
        </p>
      </div>
    );
  }
  return (
    <div className="method__params">
      <FormField
        id={id('alpha')}
        label="α (nivel)"
        inputMode="decimal"
        value={config.alpha}
        hint="Mayor que 0 y menor que 1."
        error={errorFor('alpha')}
        onChange={(event) => onChange({ alpha: event.target.value })}
      />
      {method === 'TREND_ADJUSTED_EXPONENTIAL_SMOOTHING' && (
        <FormField
          id={id('beta')}
          label="β (tendencia)"
          inputMode="decimal"
          value={config.beta}
          hint="Mayor que 0 y menor que 1."
          error={errorFor('beta')}
          onChange={(event) => onChange({ beta: event.target.value })}
        />
      )}
    </div>
  );
}

/** `methods[1].alpha` → `EXPONENTIAL_SMOOTHING.alpha`, según el orden en que se enviaron los métodos. */
function errorsByMethod(errors, chosen) {
  return errors.reduce((acc, { field, message }) => {
    const match = /^methods\[(\d+)\]\.?(.*)$/.exec(field ?? '');
    const key = match && chosen[Number(match[1])] ? `${chosen[Number(match[1])]}.${match[2] || 'method'}` : field;
    acc[key] = acc[key] ? `${acc[key]} ${message}` : message;
    return acc;
  }, {});
}

function fullRange(option) {
  return option ? { from: option.firstPeriod, to: option.lastPeriod } : { from: '', to: '' };
}

/** Meses "AAAA-MM" de `from` a `to`, ambos incluidos. */
export function monthsBetween(from, to) {
  const months = [];
  for (let month = from; month <= to; month = nextPeriod(month)) months.push(month);
  return months;
}

function nextPeriod(period) {
  const [year, month] = period.split('-').map(Number);
  return month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, '0')}`;
}
