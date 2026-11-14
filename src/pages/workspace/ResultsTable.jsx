import { useState } from 'react';
import { formatNumber, formatPercent, formatPeriod, formatSigned, METHOD_LABELS, periodHeader } from '../../format';

/**
 * Tabla de resultados y trazabilidad de un método, con las columnas de las hojas del Excel: real D(t),
 * pronóstico P(t), error E(t) = D(t) − P(t), |E(t)| y |E(t)|/D(t). Los errores los calcula el backend. Las filas
 * resaltadas son las que entran al MAD y al MAPE (la ventana común).
 */
export default function ResultsTable({ preview, defaultMethod, colors }) {
  const [chosen, setChosen] = useState(null);
  const methodCode = preview.methods.some((m) => m.method === chosen) ? chosen : defaultMethod ?? preview.methods[0]?.method;
  const method = preview.methods.find((m) => m.method === methodCode);
  if (!method) return null;
  const row = preview.comparison.methods.find((r) => r.method === methodCode);
  const { periodicity, unit } = preview;
  const evaluated = (period) => Boolean(preview.evaluationStart) && period >= preview.evaluationStart;
  const pointOf = new Map(method.forecasts.map((point) => [point.period, point]));

  return (
    <div className="results">
      <div className="panel__controls">
        <label className="inline-field">
          <span>Método</span>
          <select className="field__control field__control--compact" value={methodCode} onChange={(event) => setChosen(event.target.value)}>
            {preview.methods.map((m) => (
              <option key={m.method} value={m.method}>
                {METHOD_LABELS[m.method]}
              </option>
            ))}
          </select>
        </label>
        <span className="results__swatch" style={{ background: colors[methodCode] }} aria-hidden="true" />
        <p className="table-legend">
          <span className="table-legend__item">
            <span className="table-legend__swatch table-legend__swatch--evaluated" aria-hidden="true" />
            Entra al MAD y al MAPE
          </span>
          <span className="table-legend__item">
            <span className="table-legend__swatch table-legend__swatch--next" aria-hidden="true" />
            Pronóstico del periodo siguiente
          </span>
        </p>
      </div>
      <div className="table-wrap table-wrap--scroll">
        <table className="table table--compact table--sticky">
          <caption className="visually-hidden">Resultados de {METHOD_LABELS[methodCode]} por periodo</caption>
          <thead>
            <tr>
              <th scope="col">{periodHeader(periodicity)}</th>
              <th scope="col" className="table__number">Real D(t)</th>
              <th scope="col" className="table__number">Pronóstico P(t)</th>
              <th scope="col" className="table__number">Error E(t)</th>
              <th scope="col" className="table__number">|E(t)|</th>
              <th scope="col" className="table__number">|E(t)| / D(t)</th>
            </tr>
          </thead>
          <tbody>
            {/* Todos los periodos, como el Excel: sin pronóstico todavía se ve "—", no 0. */}
            {preview.actuals.map(({ period, value }) => {
              const point = pointOf.get(period);
              return (
                <tr key={period} className={point && evaluated(period) ? 'table__row--evaluated' : undefined}>
                  <th scope="row">{formatPeriod(period, periodicity)}</th>
                  <td className="table__number">{formatNumber(value)}</td>
                  <td className="table__number">{formatNumber(point?.forecast)}</td>
                  <td className="table__number">{formatSigned(point?.error)}</td>
                  <td className="table__number">{formatNumber(point ? Math.abs(Number(point.error)) : null)}</td>
                  <td className="table__number">
                    {!point ? '—' : point.absolutePercentError === null ? 'Real 0' : formatPercent(point.absolutePercentError)}
                  </td>
                </tr>
              );
            })}
            {method.nextForecast && (
              <tr className="table__row--next">
                <th scope="row">{formatPeriod(method.nextForecast.period, periodicity)}</th>
                <td className="table__number">—</td>
                <td className="table__number table__strong">{formatNumber(method.nextForecast.forecast)}</td>
                <td className="table__number" colSpan={3}>
                  Pronóstico
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" colSpan={4}>
                {row?.pairsUsed ?? 0} periodos evaluados
              </th>
              <td className="table__number table__strong">MAD {formatNumber(row?.mad)}{unit && ` ${unit}`}</td>
              <td className="table__number table__strong">MAPE {formatPercent(row?.mapePercent)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
