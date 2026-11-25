import { formatPeriod, METHOD_LABELS, METHOD_ORDER } from '../../format';
import { MAX_WEIGHTS, weightsSum } from '../forecast/methodConfig';

/**
 * Celdas de parámetros encima de los resultados, como en el Excel (n, K0…Kn, α, β, L). Cada cambio recalcula
 * todo en vivo. Los errores llegan por `errors` con la clave `MÉTODO.campo`.
 */
export default function ParameterBar({ config, onChange, errors, periods, range, onRangeChange, periodicity }) {
  const update = (method, changes) => onChange({ ...config, [method]: { ...config[method], ...changes } });

  return (
    <div className="params" role="group" aria-label="Parámetros del pronóstico">
      <fieldset className="param-card param-card--range">
        <legend className="param-card__title">Periodo histórico</legend>
        <div className="param-card__cells">
          <ParamSelect
            id="range-from"
            label="Desde"
            value={range.from}
            onChange={(value) => onRangeChange({ ...range, from: value })}
            options={periods.map((period) => ({ value: period, label: formatPeriod(period, periodicity), disabled: period > range.to }))}
          />
          <ParamSelect
            id="range-to"
            label="Hasta"
            value={range.to}
            onChange={(value) => onRangeChange({ ...range, to: value })}
            options={periods.map((period) => ({ value: period, label: formatPeriod(period, periodicity), disabled: period < range.from }))}
          />
        </div>
        {errors.from && <p className="field__error">{errors.from}</p>}
        {errors.to && <p className="field__error">{errors.to}</p>}
      </fieldset>
      {errors.methods && <p className="field__error">{errors.methods}</p>}
      {METHOD_ORDER.map((method) => (
        <fieldset key={method} className={config[method].enabled ? 'param-card' : 'param-card param-card--off'}>
          <legend className="param-card__title">
            <label className="param-card__toggle">
              <input
                type="checkbox"
                checked={config[method].enabled}
                onChange={(event) => update(method, { enabled: event.target.checked })}
              />
              {METHOD_LABELS[method]}
            </label>
          </legend>
          {config[method].enabled && (
            <MethodCells
              method={method}
              config={config[method]}
              errorFor={(field) => errors[`${method}.${field}`]}
              onChange={(changes) => update(method, changes)}
            />
          )}
          {errors[`${method}.method`] && <p className="field__error">{errors[`${method}.method`]}</p>}
        </fieldset>
      ))}
    </div>
  );
}

function MethodCells({ method, config, errorFor, onChange }) {
  const id = (field) => `param-${method}-${field}`;
  if (method === 'SIMPLE_MOVING_AVERAGE') {
    return (
      <div className="param-card__cells">
        <ParamInput id={id('periods')} label="n" title="Periodos a promediar" value={config.periods} error={errorFor('periods')} inputMode="numeric" onChange={(periods) => onChange({ periods })} />
      </div>
    );
  }
  if (method === 'LINEAR_REGRESSION') {
    return <p className="param-card__note">Sin parámetros: P = b·t + a.</p>;
  }
  if (method === 'SEASONAL_MULTIPLICATIVE') {
    return (
      <>
        <div className="param-card__cells">
          <ParamInput id={id('seasonLength')} label="L" title="Periodos por ciclo (12 en una serie mensual)" value={config.seasonLength} error={errorFor('seasonLength')} inputMode="numeric" onChange={(seasonLength) => onChange({ seasonLength })} />
        </div>
        <p className="param-card__note">Se muestra, pero no compite por el mejor método.</p>
      </>
    );
  }
  if (method === 'WEIGHTED_MOVING_AVERAGE') {
    const sum = weightsSum(config.weights);
    const sumOk = Math.abs(sum - 1) <= 1e-9;
    const resize = (count) => onChange({ weights: Array.from({ length: count }, (_, i) => config.weights[i] ?? '') });
    return (
      <>
        <div className="param-card__cells">
          <ParamSelect
            id={id('count')}
            label="n"
            value={String(config.weights.length)}
            onChange={(value) => resize(Number(value))}
            options={Array.from({ length: MAX_WEIGHTS }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))}
          />
          {config.weights.map((weight, index) => (
            <ParamInput
              key={index}
              id={id(`weight-${index}`)}
              label={`K${index}`}
              title={index === 0 ? 'Peso del dato más reciente' : `Peso del dato de hace ${index + 1} periodos`}
              value={weight}
              error={errorFor(`weights[${index}]`)}
              inputMode="decimal"
              onChange={(value) => onChange({ weights: config.weights.map((w, i) => (i === index ? value : w)) })}
            />
          ))}
        </div>
        <p className={sumOk ? 'param-card__sum param-card__sum--ok' : 'param-card__sum param-card__sum--bad'} role="status">
          <span aria-hidden="true">{sumOk ? '✓' : '✕'}</span> Suma de K: {String(Math.round(sum * 1e6) / 1e6).replace('.', ',')}
          {sumOk ? '' : ' (debe ser 1)'}
        </p>
        {/* Si la suma ya está mal, el aviso de arriba lo dice; aquí van los demás errores de los pesos. */}
        {sumOk && errorFor('weights') && <p className="field__error">{errorFor('weights')}</p>}
      </>
    );
  }
  return (
    <div className="param-card__cells">
      <ParamInput id={id('alpha')} label="α" title="Nivel: mayor que 0 y menor que 1" value={config.alpha} error={errorFor('alpha')} inputMode="decimal" onChange={(alpha) => onChange({ alpha })} />
      {method === 'TREND_ADJUSTED_EXPONENTIAL_SMOOTHING' && (
        <ParamInput id={id('beta')} label="β" title="Tendencia: mayor que 0 y menor que 1" value={config.beta} error={errorFor('beta')} inputMode="decimal" onChange={(beta) => onChange({ beta })} />
      )}
    </div>
  );
}

function ParamInput({ id, label, title, value, error, inputMode, onChange }) {
  return (
    <div className="param">
      <label className="param__label" htmlFor={id} title={title}>
        {label} =
      </label>
      <input
        id={id}
        className={error ? 'param__input param__input--invalid' : 'param__input'}
        value={value}
        inputMode={inputMode}
        autoComplete="off"
        title={title}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {error && (
        <span className="param__error" id={`${id}-error`}>
          {error}
        </span>
      )}
    </div>
  );
}

function ParamSelect({ id, label, value, options, onChange }) {
  return (
    <div className="param">
      <label className="param__label" htmlFor={id}>
        {label}
      </label>
      <select id={id} className="param__input param__input--select" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
