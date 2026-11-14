import { formatNumber, formatPercent, formatPeriod, METHOD_LABELS } from '../../format';

/**
 * Tarjetas de arriba: el mejor método por MAD y por MAPE (una sola tarjeta si es el mismo), el pronóstico del
 * periodo siguiente según el mejor y el último dato real. El estacional no compite (ADR 13 del backend).
 */
export default function KpiCards({ preview, colors }) {
  const { comparison, methods, periodicity, unit } = preview;
  const rowOf = (code) => comparison.methods.find((row) => row.method === code);
  const methodOf = (code) => methods.find((m) => m.method === code);
  const bestMad = comparison.bestByMad[0];
  const bestMape = comparison.bestByMape[0];
  const same = bestMad && bestMad === bestMape;
  const lastActual = preview.actuals[preview.actuals.length - 1];
  const leaders = [...new Set([bestMad, bestMape].filter(Boolean))];
  const nextPeriod = methods[0]?.nextForecast?.period;

  return (
    <div className="kpis">
      {same ? (
        <Kpi label="Mejor método" color={colors[bestMad]} method={bestMad}>
          <span className="kpi__value">{METHOD_LABELS[bestMad]}</span>
          <span className="kpi__detail">
            MAD {formatNumber(rowOf(bestMad).mad)} {unit} · MAPE {formatPercent(rowOf(bestMad).mapePercent)}
          </span>
        </Kpi>
      ) : (
        <>
          <Kpi label="Mejor por MAD" color={colors[bestMad]} method={bestMad}>
            {bestMad ? (
              <>
                <span className="kpi__value">
                  {formatNumber(rowOf(bestMad).mad)} <small>{unit}</small>
                </span>
                <span className="kpi__detail">{METHOD_LABELS[bestMad]}</span>
              </>
            ) : (
              <NotCalculable />
            )}
          </Kpi>
          <Kpi label="Mejor por MAPE" color={colors[bestMape]} method={bestMape}>
            {bestMape ? (
              <>
                <span className="kpi__value">{formatPercent(rowOf(bestMape).mapePercent)}</span>
                <span className="kpi__detail">{METHOD_LABELS[bestMape]}</span>
              </>
            ) : (
              <NotCalculable />
            )}
          </Kpi>
        </>
      )}
      <Kpi label={`Pronóstico ${formatPeriod(nextPeriod, periodicity)}`}>
        {leaders.length === 0 ? (
          <NotCalculable />
        ) : (
          leaders.map((code) => (
            <span key={code} className="kpi__line">
              <span className="kpi__value">
                {formatNumber(methodOf(code)?.nextForecast?.forecast)} <small>{unit}</small>
              </span>
              <span className="kpi__detail">según {METHOD_LABELS[code]}</span>
            </span>
          ))
        )}
      </Kpi>
      <Kpi label="Último dato real">
        <span className="kpi__value">
          {formatNumber(lastActual?.value)} <small>{unit}</small>
        </span>
        <span className="kpi__detail">{formatPeriod(lastActual?.period, periodicity)}</span>
      </Kpi>
    </div>
  );
}

function Kpi({ label, color, method, children }) {
  return (
    <section className="kpi" aria-label={label}>
      <h3 className="kpi__label">
        {color && <span className="kpi__swatch" style={{ background: color }} aria-hidden="true" />}
        {label}
        {method && <span className="visually-hidden">: {METHOD_LABELS[method]}</span>}
      </h3>
      <div className="kpi__body">{children}</div>
    </section>
  );
}

function NotCalculable() {
  return (
    <>
      <span className="kpi__value kpi__value--muted">No calculable</span>
      <span className="kpi__detail">Ningún periodo tuvo pronóstico de todos los métodos.</span>
    </>
  );
}
