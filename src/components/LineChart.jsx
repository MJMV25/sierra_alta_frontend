import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { formatNumber, formatPeriod } from '../format';

const HEIGHT = 300;
const MARGIN = { top: 16, bottom: 44, side: 28 };
const PLOT_H = HEIGHT - MARGIN.top - MARGIN.bottom;
const Y_AXIS_W = 64;
/** Ancho mínimo por mes: con más meses de los que caben, el gráfico se desplaza en horizontal. */
const MIN_STEP = 34;
/** Distancia mínima entre etiquetas del eje X para que no se monten. */
const MIN_LABEL_GAP = 46;
const SHORT_MONTH = new Intl.DateTimeFormat('es-CO', { month: 'short', timeZone: 'UTC' });

/**
 * Líneas sobre meses consecutivos con un solo eje Y. `series`: [{ key, label, color, dashed?, values }],
 * donde `values` tiene un valor (o null) por cada elemento de `periods`.
 *
 * Cada mes ocupa al menos MIN_STEP píxeles: si no caben en el ancho disponible, la zona del gráfico se
 * desplaza en horizontal (el eje Y queda fijo) y abre mostrando los meses más recientes. Al pasar el mouse,
 * tocar o mover el foco con las flechas, una línea guía muestra los valores de ese mes. La tabla de datos
 * va aparte (accesible).
 */
export default function LineChart({ title, periods, series }) {
  const titleId = useId();
  const hintId = useId();
  const scrollRef = useRef(null);
  const [available, setAvailable] = useState(720);
  const [active, setActive] = useState(null);

  // Ancho real del contenedor; en pruebas (sin ResizeObserver) se usa el valor inicial.
  useEffect(() => {
    const element = scrollRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(([entry]) => setAvailable(Math.floor(entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const layout = useMemo(() => {
    const values = series.flatMap((s) => s.values).filter((v) => v !== null && v !== undefined);
    const ticks = niceTicks(Math.min(0, ...values), Math.max(...values, 1));
    const min = ticks[0];
    const max = ticks[ticks.length - 1];
    const gaps = Math.max(periods.length - 1, 1);
    const step = Math.max(MIN_STEP, (available - 2 * MARGIN.side) / gaps);
    const width = Math.max(available, Math.round(step * gaps + 2 * MARGIN.side));
    return {
      ticks,
      step,
      width,
      scrolls: width > available + 1,
      labelEvery: Math.max(1, Math.ceil(MIN_LABEL_GAP / step)),
      x: (i) => (periods.length > 1 ? MARGIN.side + i * step : width / 2),
      y: (v) => MARGIN.top + PLOT_H - ((v - min) / (max - min)) * PLOT_H,
    };
  }, [periods, series, available]);

  // Abre mostrando el final: los últimos meses reales y el mes pronosticado.
  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (element && layout.scrolls) element.scrollLeft = element.scrollWidth;
  }, [layout.scrolls, layout.width]);

  // Con el teclado, el mes activo se mantiene visible.
  useEffect(() => {
    const element = scrollRef.current;
    if (!element || active === null || !layout.scrolls) return;
    const x = layout.x(active);
    if (x < element.scrollLeft + 40 || x > element.scrollLeft + element.clientWidth - 40) {
      element.scrollLeft = x - element.clientWidth / 2;
    }
  }, [active, layout]);

  const indexAt = (clientX, svg) => {
    const box = svg.getBoundingClientRect();
    if (periods.length < 2) return 0;
    const i = Math.round((clientX - box.left - MARGIN.side) / layout.step);
    return Math.min(periods.length - 1, Math.max(0, i));
  };

  const handleKey = (event) => {
    const moves = { ArrowRight: 1, ArrowLeft: -1, Home: -Infinity, End: Infinity };
    if (!(event.key in moves)) return;
    event.preventDefault();
    setActive((i) => Math.min(periods.length - 1, Math.max(0, (i ?? periods.length - 1) + moves[event.key])));
  };

  const tooltipLeft = active === null ? 0 : layout.x(active);
  const tooltipFlip = active !== null && tooltipLeft > layout.width - 240;

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
      <div className="chart__frame">
        <svg className="chart__y-axis" width={Y_AXIS_W} height={HEIGHT} aria-hidden="true">
          {layout.ticks.map((tick) => (
            <text key={tick} className="chart__axis" x={Y_AXIS_W - 8} y={layout.y(tick)} textAnchor="end" dominantBaseline="middle">
              {formatNumber(tick)}
            </text>
          ))}
        </svg>
        <div className="chart__scroll" ref={scrollRef}>
          <div className="chart__canvas" style={{ width: `${layout.width}px` }}>
            <svg
              width={layout.width}
              height={HEIGHT}
              role="img"
              aria-labelledby={titleId}
              aria-describedby={layout.scrolls ? hintId : undefined}
              tabIndex={0}
              onMouseMove={(event) => setActive(indexAt(event.clientX, event.currentTarget))}
              onMouseLeave={() => setActive(null)}
              onTouchStart={(event) => setActive(indexAt(event.touches[0].clientX, event.currentTarget))}
              onKeyDown={handleKey}
              onBlur={() => setActive(null)}
            >
              {layout.ticks.map((tick) => (
                <line key={tick} className="chart__grid" x1={0} x2={layout.width} y1={layout.y(tick)} y2={layout.y(tick)} />
              ))}
              {periods.map((period, i) =>
                showLabel(i, periods.length, layout) ? (
                  <XLabel key={period} period={period} x={layout.x(i)} showYear={i === 0 || period.endsWith('-01') || i === periods.length - 1} />
                ) : null,
              )}
              {series.map((s) => (
                <path
                  key={s.key}
                  d={linePath(s.values, layout)}
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
                  <line className="chart__crosshair" x1={layout.x(active)} x2={layout.x(active)} y1={MARGIN.top} y2={MARGIN.top + PLOT_H} />
                  {series.map((s) =>
                    s.values[active] === null || s.values[active] === undefined ? null : (
                      <circle key={s.key} cx={layout.x(active)} cy={layout.y(s.values[active])} r="4" fill={s.color} className="chart__dot" />
                    ),
                  )}
                </g>
              )}
            </svg>
            {active !== null && (
              <div
                className="chart__tooltip"
                role="status"
                style={{ left: `${tooltipLeft}px`, transform: tooltipFlip ? 'translateX(calc(-100% - 12px))' : 'translateX(12px)' }}
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
        </div>
      </div>
      {layout.scrolls && (
        <p className="chart__hint" id={hintId}>
          {periods.length} meses: desplace el gráfico hacia los lados para ver todos (también con las flechas del
          teclado).
        </p>
      )}
    </figure>
  );
}

/** Mes abreviado y, en enero, en el primer y en el último mes, el año debajo: "abr" / "2022". */
function XLabel({ period, x, showYear }) {
  const [year, month] = period.split('-').map(Number);
  const name = SHORT_MONTH.format(new Date(Date.UTC(year, month - 1, 1))).replace('.', '');
  return (
    <text className="chart__axis" x={x} y={HEIGHT - MARGIN.bottom + 18} textAnchor="middle">
      {name}
      {showYear && (
        <tspan className="chart__axis-year" x={x} dy="14">
          {year}
        </tspan>
      )}
    </text>
  );
}

/** Una etiqueta cada `labelEvery` meses y siempre la del último; se omite la que quedaría encima de esta. */
function showLabel(i, count, layout) {
  const last = count - 1;
  if (i === last) return true;
  return i % layout.labelEvery === 0 && (last - i) * layout.step >= MIN_LABEL_GAP;
}

/** Une los puntos con valor; un null corta la línea (p. ej. meses sin pronóstico). */
function linePath(values, layout) {
  let path = '';
  let drawing = false;
  values.forEach((value, i) => {
    if (value === null || value === undefined) {
      drawing = false;
      return;
    }
    path += `${drawing ? 'L' : 'M'}${layout.x(i).toFixed(1)},${layout.y(value).toFixed(1)}`;
    drawing = true;
  });
  return path;
}

/** Unas 6 marcas redondas (1, 2 o 5 × 10^k) que cubren [min, max]; un valor apenas negativo no estira el eje. */
function niceTicks(min, max) {
  const span = max - min || Math.abs(max) || 1;
  const raw = span / 6;
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
