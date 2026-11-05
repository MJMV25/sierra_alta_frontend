import { useId, useMemo, useState } from 'react';
import { formatNumber, formatPeriod } from '../format';

const WIDTH = 760;
const HEIGHT = 300;
const MARGIN = { top: 16, right: 16, bottom: 32, left: 64 };
const PLOT_W = WIDTH - MARGIN.left - MARGIN.right;
const PLOT_H = HEIGHT - MARGIN.top - MARGIN.bottom;

/**
 * Líneas sobre meses consecutivos con un solo eje Y. `series`: [{ key, label, color, dashed?, values }],
 * donde `values` tiene un valor (o null) por cada elemento de `periods`. Al pasar el mouse o mover el foco
 * con las flechas, una línea guía muestra los valores de ese mes. La tabla de datos va aparte (accesible).
 */
export default function LineChart({ title, periods, series }) {
  const titleId = useId();
  const [active, setActive] = useState(null);

  const scale = useMemo(() => {
    const values = series.flatMap((s) => s.values).filter((v) => v !== null && v !== undefined);
    const ticks = niceTicks(Math.min(0, ...values), Math.max(...values, 1));
    const min = ticks[0];
    const max = ticks[ticks.length - 1];
    const step = periods.length > 1 ? PLOT_W / (periods.length - 1) : 0;
    return {
      ticks,
      x: (i) => MARGIN.left + (periods.length > 1 ? i * step : PLOT_W / 2),
      y: (v) => MARGIN.top + PLOT_H - ((v - min) / (max - min)) * PLOT_H,
      step,
    };
  }, [periods, series]);

  const labelEvery = Math.max(1, Math.ceil(periods.length / 8));

  const indexAt = (event) => {
    const box = event.currentTarget.getBoundingClientRect();
    const svgX = ((event.clientX - box.left) / box.width) * WIDTH;
    if (scale.step === 0) return 0;
    return Math.min(periods.length - 1, Math.max(0, Math.round((svgX - MARGIN.left) / scale.step)));
  };

  const handleKey = (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const delta = event.key === 'ArrowRight' ? 1 : -1;
    setActive((i) => Math.min(periods.length - 1, Math.max(0, (i ?? periods.length - 1) + delta)));
  };

  return (
    <figure className="chart">
      <figcaption className="chart__title" id={titleId}>
        {title}
      </figcaption>
      <ul className="chart__legend">
        {series.map((s) => (
          <li key={s.key}>
            <svg width="22" height="10" aria-hidden="true">
              <line x1="1" y1="5" x2="21" y2="5" stroke={s.color} strokeWidth="2" strokeDasharray={s.dashed ? '4 3' : undefined} />
            </svg>
            {s.label}
          </li>
        ))}
      </ul>
      <div className="chart__plot">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-labelledby={titleId}
          tabIndex={0}
          onMouseMove={(event) => setActive(indexAt(event))}
          onMouseLeave={() => setActive(null)}
          onKeyDown={handleKey}
          onBlur={() => setActive(null)}
        >
          {scale.ticks.map((tick) => (
            <g key={tick}>
              <line className="chart__grid" x1={MARGIN.left} x2={WIDTH - MARGIN.right} y1={scale.y(tick)} y2={scale.y(tick)} />
              <text className="chart__axis" x={MARGIN.left - 8} y={scale.y(tick)} textAnchor="end" dominantBaseline="middle">
                {formatNumber(tick)}
              </text>
            </g>
          ))}
          {periods.map((period, i) =>
            i % labelEvery === 0 || i === periods.length - 1 ? (
              <text key={period} className="chart__axis" x={scale.x(i)} y={HEIGHT - 10} textAnchor="middle">
                {formatPeriod(period)}
              </text>
            ) : null,
          )}
          {series.map((s) => (
            <path
              key={s.key}
              d={linePath(s.values, scale)}
              fill="none"
              stroke={s.color}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeDasharray={s.dashed ? '6 4' : undefined}
            />
          ))}
          {active !== null && (
            <g>
              <line className="chart__crosshair" x1={scale.x(active)} x2={scale.x(active)} y1={MARGIN.top} y2={MARGIN.top + PLOT_H} />
              {series.map((s) =>
                s.values[active] === null || s.values[active] === undefined ? null : (
                  <circle
                    key={s.key}
                    cx={scale.x(active)}
                    cy={scale.y(s.values[active])}
                    r="4"
                    fill={s.color}
                    className="chart__dot"
                  />
                ),
              )}
            </g>
          )}
        </svg>
        {active !== null && (
          <div
            className="chart__tooltip"
            role="status"
            style={{
              left: `${(scale.x(active) / WIDTH) * 100}%`,
              transform: active > periods.length / 2 ? 'translateX(calc(-100% - 12px))' : 'translateX(12px)',
            }}
          >
            <p className="chart__tooltip-title">{formatPeriod(periods[active])}</p>
            {series.map((s) => (
              <p key={s.key} className="chart__tooltip-row">
                <span className="chart__swatch" style={{ background: s.color }} aria-hidden="true" />
                <span>{s.label}</span>
                <strong>{formatNumber(s.values[active])}</strong>
              </p>
            ))}
          </div>
        )}
      </div>
    </figure>
  );
}

/** Une los puntos con valor; un null corta la línea (p. ej. meses sin pronóstico). */
function linePath(values, scale) {
  let path = '';
  let drawing = false;
  values.forEach((value, i) => {
    if (value === null || value === undefined) {
      drawing = false;
      return;
    }
    path += `${drawing ? 'L' : 'M'}${scale.x(i).toFixed(1)},${scale.y(value).toFixed(1)}`;
    drawing = true;
  });
  return path;
}

/** De 4 a 6 marcas redondas (1, 2 o 5 × 10^k) que cubren [min, max]. */
function niceTicks(min, max) {
  const span = max - min || Math.abs(max) || 1;
  const raw = span / 5;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= raw);
  const start = Math.floor(min / step) * step;
  const ticks = [];
  for (let v = start; v < max + step; v += step) {
    ticks.push(Number(v.toFixed(10)));
    if (v >= max) break;
  }
  return ticks;
}
