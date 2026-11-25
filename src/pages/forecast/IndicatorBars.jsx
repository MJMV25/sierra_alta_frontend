import { useId } from 'react';
import { formatNumber, formatPercent, METHOD_LABELS } from '../../format';

/**
 * MAD y MAPE en dos gráficos de barras separados (unidades y porcentaje no comparten eje). Cada barra lleva
 * el color elegido para su método y el valor escrito en tinta al final.
 * `rows` ya viene en el orden elegido en la tabla.
 */
export default function IndicatorBars({ rows, colors, unit }) {
  return (
    <div className="indicator-charts">
      <Bars
        title={`MAD${unit ? ` (${unit})` : ''}`}
        rows={rows}
        colors={colors}
        valueOf={(row) => row.mad}
        format={formatNumber}
        bestKey="bestByMad"
      />
      <Bars
        title="MAPE"
        rows={rows}
        colors={colors}
        valueOf={(row) => row.mapePercent}
        format={formatPercent}
        bestKey="bestByMape"
      />
    </div>
  );
}

function Bars({ title, rows, colors, valueOf, format, bestKey }) {
  const values = rows.map(valueOf).filter((v) => v !== null && v !== undefined).map(Number);
  const max = Math.max(...values, Number.MIN_VALUE);
  const titleId = useId();
  const percent = (value) => `${Math.max(0, (Number(value) / max) * 100)}%`;
  return (
    <figure className="bars" aria-labelledby={titleId}>
      <figcaption className="bars__title" id={titleId}>
        {title}
        <span className="bars__subtitle">menor es mejor</span>
      </figcaption>
      <ul className="bars__list">
        {rows.map((row) => {
          const value = valueOf(row);
          const name = METHOD_LABELS[row.method] ?? row.method;
          return (
            <li key={row.method} className="bars__row">
              <span className="bars__label">
                {name}
                {row[bestKey] && <span className="visually-hidden"> (el menor)</span>}
              </span>
              <span className="bars__track">
                {value === null || value === undefined ? (
                  <span className="bars__empty">No calculable</span>
                ) : (
                  <>
                    <span className="bars__bar" style={{ width: percent(value), background: colors[row.method] }} />
                    <span className={row[bestKey] ? 'bars__value bars__value--best' : 'bars__value'}>
                      {format(value)}
                      {row[bestKey] && ' ★'}
                    </span>
                  </>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </figure>
  );
}
