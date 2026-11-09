import { forwardRef, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { formatNumber, formatPeriod, periodIndex, periodWord, TEST_PERIODICITY } from '../format';

const HEIGHT = 300;
const MARGIN = { top: 22, bottom: 44, side: 28 };
const PLOT_H = HEIGHT - MARGIN.top - MARGIN.bottom;
export const Y_AXIS_W = 64;
/** Ancho mínimo por mes: con más meses de los que caben, el gráfico se desplaza en horizontal. */
const MIN_STEP = 34;
/** Con etiquetas de valor cada mes necesita más espacio para que los números no se monten. */
const MIN_STEP_WITH_VALUES = 58;
/** Ancho mínimo de cada columna dentro del grupo de un mes. */
const MIN_BAR = 6;
const MAX_BAR = 22;
/** Distancia mínima entre etiquetas del eje X para que no se monten. */
const MIN_LABEL_GAP = 46;
/** Distancia vertical mínima entre dos etiquetas de valor del mismo mes. */
const MIN_VALUE_GAP = 13;
const SHORT_MONTH = new Intl.DateTimeFormat('es-CO', { month: 'short', timeZone: 'UTC' });

/**
 * Series sobre meses consecutivos con un solo eje Y. `series`: [{ key, label, color, dashed?, values }],
 * donde `values` tiene un valor (o null) por cada elemento de `periods`.
 *
 * `type`: 'line' (todas en línea), 'column' (todas en columnas agrupadas por mes) o 'combo' (las series de
 * `columnKeys` en columnas y el resto en línea). Las columnas siempre arrancan en 0; las líneas pueden usar
 * una escala ajustada a los datos (`zeroBased = false`). `showValues` escribe el valor de cada punto y omite
 * el que quedaría encima de otro.
 *
 * Cada mes ocupa al menos MIN_STEP píxeles: si no caben en el ancho disponible, la zona del gráfico se
 * desplaza en horizontal (el eje Y queda fijo) y abre mostrando los meses más recientes. Al pasar el mouse,
 * tocar o mover el foco con las flechas, una línea guía muestra los valores de ese mes. La tabla de datos
 * va aparte (accesible). El `ref` apunta a la figura, para exportarla como imagen.
 */
const LineChart = forwardRef(function LineChart(
  { title, periods, series, type = 'line', columnKeys = [], showValues = false, zeroBased = true, periodicity },
  ref,
) {
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

  const asColumn = (s) => type === 'column' || (type === 'combo' && columnKeys.includes(s.key));
  const columns = series.filter(asColumn);
  const lines = series.filter((s) => !asColumn(s));

  const layout = useMemo(() => {
    const values = series.flatMap((s) => s.values).filter((v) => v !== null && v !== undefined);
    const fromZero = zeroBased || columns.length > 0 || values.length === 0;
    const low = values.length === 0 ? 0 : Math.min(...values);
    const high = values.length === 0 ? 1 : Math.max(...values);
    const ticks = fromZero ? niceTicks(Math.min(0, low), Math.max(high, 1)) : niceTicks(low, high === low ? low + 1 : high);
    const min = ticks[0];
    const max = ticks[ticks.length - 1];
    const gaps = Math.max(periods.length - 1, 1);
    const minStep = Math.max(
      showValues ? MIN_STEP_WITH_VALUES : MIN_STEP,
      columns.length > 0 ? columns.length * MIN_BAR + 12 : 0,
    );
    // Con columnas, medio mes de aire a cada lado para que la primera y la última no se corten.
    const side = columns.length > 0 ? Math.max(MARGIN.side, minStep / 2 + 4) : MARGIN.side;
    const step = Math.max(minStep, (available - 2 * side) / gaps);
    const width = Math.max(available, Math.round(step * gaps + 2 * side));
    const bar = Math.min(MAX_BAR, Math.max(MIN_BAR - 1, (step * 0.72) / Math.max(columns.length, 1) - 2));
    return {
      ticks,
      step,
      side,
      width,
      bar,
      scrolls: width > available + 1,
      labelEvery: Math.max(1, Math.ceil(MIN_LABEL_GAP / step)),
      x: (i) => (periods.length > 1 ? side + i * step : width / 2),
      y: (v) => MARGIN.top + PLOT_H - ((v - min) / (max - min)) * PLOT_H,
    };
  }, [periods, series, available, showValues, zeroBased, columns.length]);

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

  // Si cambian los meses visibles, el mes activo puede quedar fuera.
  useEffect(() => setActive(null), [periods.length]);

  const indexAt = (clientX, svg) => {
    const box = svg.getBoundingClientRect();
    if (periods.length < 2) return 0;
    const i = Math.round((clientX - box.left - layout.side) / layout.step);
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
  const baseline = layout.y(Math.max(layout.ticks[0], 0));
  const columnX = (i, c) => layout.x(i) + (c - (columns.length - 1) / 2) * (layout.bar + 2) - layout.bar / 2;

  return (
    <figure className="chart" ref={ref}>
      <figcaption className="chart__title" id={titleId}>
        {title}
      </figcaption>
      <ul className="chart__legend">
        {series.map((s) => (
          <li key={s.key}>
            <svg width="22" height="10" aria-hidden="true">
              {asColumn(s) ? (
                <rect x="6" y="0" width="10" height="10" rx="2" fill={s.color} />
              ) : (
                <line x1="1" y1="5" x2="21" y2="5" stroke={s.color} strokeWidth="2" strokeDasharray={s.dashed ? '4 3' : undefined} />
              )}
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
              className="chart__plot"
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
                <line
                  key={tick}
                  className={tick === 0 ? 'chart__grid chart__grid--zero' : 'chart__grid'}
                  x1={0}
                  x2={layout.width}
                  y1={layout.y(tick)}
                  y2={layout.y(tick)}
                />
              ))}
              {periods.map((period, i) =>
                showLabel(i, periods.length, layout) ? (
                  <XLabel key={period} period={period} periodicity={periodicity} x={layout.x(i)} showYear={i === 0 || period.endsWith('-01') || i === periods.length - 1} />
                ) : null,
              )}
              {columns.map((s, c) => (
                <g key={s.key} fill={s.color}>
                  {s.values.map((value, i) =>
                    value === null || value === undefined ? null : (
                      <path key={periods[i]} d={columnPath(columnX(i, c), layout.bar, baseline, layout.y(value))} />
                    ),
                  )}
                </g>
              ))}
              {lines.map((s) => (
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
              {lines.map((s) =>
                s.values.map((value, i) =>
                  isolated(s.values, i) ? (
                    <circle key={`${s.key}-${periods[i]}`} cx={layout.x(i)} cy={layout.y(value)} r="3.5" fill={s.color} />
                  ) : null,
                ),
              )}
              {showValues && <ValueLabels periods={periods} series={series} layout={layout} columnX={columnX} columns={columns} />}
              {active !== null && (
                <g>
                  <line className="chart__crosshair" x1={layout.x(active)} x2={layout.x(active)} y1={MARGIN.top} y2={MARGIN.top + PLOT_H} />
                  {lines.map((s) =>
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
                <p className="chart__tooltip-title">{formatPeriod(periods[active], periodicity)}</p>
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
          {periods.length} {periodWord(periods.length, periodicity)}: desplace el gráfico hacia los lados para ver todos (también con las flechas del
          teclado).
        </p>
      )}
    </figure>
  );
});

export default LineChart;

/**
 * Mes abreviado y, en enero, en el primer y en el último mes, el año debajo: "abr" / "2022". En una serie
 * de prueba del Excel (PERIODO), solo el número t.
 */
function XLabel({ period, periodicity, x, showYear }) {
  if (periodicity === TEST_PERIODICITY) {
    return (
      <text className="chart__axis" x={x} y={HEIGHT - MARGIN.bottom + 18} textAnchor="middle">
        {periodIndex(period)}
      </text>
    );
  }
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

/**
 * Valor sobre cada punto o columna, en tinta (nunca en el color de la serie). En cada mes se ordenan de
 * arriba abajo y se omite la etiqueta que quedaría a menos de MIN_VALUE_GAP de la anterior.
 */
function ValueLabels({ periods, series, layout, columnX, columns }) {
  const labels = [];
  periods.forEach((period, i) => {
    const placed = [];
    const candidates = series
      .map((s) => ({ s, value: s.values[i] }))
      .filter(({ value }) => value !== null && value !== undefined)
      .map(({ s, value }) => {
        const c = columns.indexOf(s);
        const x = c >= 0 ? columnX(i, c) + layout.bar / 2 : layout.x(i);
        return { key: `${s.key}-${period}`, x, y: layout.y(value) - (value < 0 ? -14 : 7), value };
      })
      .sort((a, b) => a.y - b.y);
    candidates.forEach((label) => {
      if (placed.every((other) => Math.abs(other.y - label.y) >= MIN_VALUE_GAP || Math.abs(other.x - label.x) > 40)) {
        placed.push(label);
        labels.push(label);
      }
    });
  });
  return (
    <g className="chart__values">
      {labels.map((label) => (
        <text key={label.key} x={label.x} y={Math.max(10, label.y)} textAnchor="middle">
          {formatNumber(Math.round(label.value))}
        </text>
      ))}
    </g>
  );
}

/** Una etiqueta cada `labelEvery` meses y siempre la del último; se omite la que quedaría encima de esta. */
function showLabel(i, count, layout) {
  const last = count - 1;
  if (i === last) return true;
  return i % layout.labelEvery === 0 && (last - i) * layout.step >= MIN_LABEL_GAP;
}

/** Columna con la punta redondeada (4 px) y la base recta sobre el eje. */
function columnPath(x, width, base, top) {
  const height = base - top;
  if (Math.abs(height) < 0.5) return `M${x},${base}h${width}`;
  const r = Math.min(4, width / 2, Math.abs(height));
  if (height > 0) {
    return `M${x},${base}V${top + r}Q${x},${top} ${x + r},${top}H${x + width - r}Q${x + width},${top} ${x + width},${top + r}V${base}Z`;
  }
  return `M${x},${base}V${top - r}Q${x},${top} ${x + r},${top}H${x + width - r}Q${x + width},${top} ${x + width},${top - r}V${base}Z`;
}

/** Un punto sin vecinos con valor no forma línea: se dibuja como círculo para que no desaparezca. */
function isolated(values, i) {
  const has = (j) => values[j] !== null && values[j] !== undefined;
  return has(i) && !has(i - 1) && !has(i + 1);
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
