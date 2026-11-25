import { useMemo, useState } from 'react';
import LineChart from '../../components/LineChart';
import { chartToSvg, svgToPng } from '../../export/chartImage';
import { download, fileBaseName, forecastTable } from '../../export/report';
import { formatPeriod, METHOD_LABELS, METHOD_SHORT_LABELS, TEST_PERIODICITY } from '../../format';
import { hexOf } from './useSeriesColors';

const CHART_TYPES = { line: 'Líneas', column: 'Columnas', combo: 'Combinado' };

function initialView(periods) {
  return { hidden: [], type: 'line', showValues: false, zeroBased: true, from: periods[0], to: periods[periods.length - 1] };
}

/** Gráfico con sus opciones de vista: series visibles y su color, tipo, valores, escala y rango de meses. */
export default function ForecastChart({ detail, measure, chartRef, canExport, onExport, seriesColors }) {
  const table = useMemo(() => forecastTable(detail), [detail]);
  const [view, setView] = useState(() => initialView(table.periods));
  const change = (changes) => setView((current) => ({ ...current, ...changes }));
  const { colors, setColor, resetColors, isCustom } = seriesColors;

  const allSeries = [
    { key: 'real', label: `${measure} real`, color: colors.real, values: table.actuals },
    ...table.methods.map((column) => ({
      key: column.method,
      label: METHOD_LABELS[column.method] ?? column.method,
      color: colors[column.method],
      dashed: view.type === 'line' || view.type === 'combo',
      values: column.values,
    })),
  ];
  const start = Math.max(0, table.periods.indexOf(view.from));
  const end = Math.max(start, table.periods.indexOf(view.to));
  const periods = table.periods.slice(start, end + 1);
  const series = allSeries
    .filter((s) => !view.hidden.includes(s.key))
    .map((s) => ({ ...s, values: s.values.slice(start, end + 1) }));
  const toggle = (key) =>
    change({ hidden: view.hidden.includes(key) ? view.hidden.filter((k) => k !== key) : [...view.hidden, key] });
  const fixedZero = view.type !== 'line';
  const isInitial = !isCustom && JSON.stringify(view) === JSON.stringify(initialView(table.periods));
  const reset = () => {
    setView(initialView(table.periods));
    resetColors();
  };
  const name = fileBaseName(detail);
  const image = () => chartToSvg(chartRef.current, { title: `${measure} real y pronosticada · ${detail.productName}` });

  return (
    <>
      <div className="chart-controls no-print">
        <fieldset className="chart-controls__group">
          <legend>Series y colores</legend>
          <div className="chips">
            {allSeries.map((s) => (
              <span key={s.key} className="chip-group">
                <label className="chip">
                  <input type="checkbox" checked={!view.hidden.includes(s.key)} onChange={() => toggle(s.key)} />
                  <span className="chip__swatch" style={{ background: s.color }} aria-hidden="true" />
                  {s.key === 'real' ? 'Real' : (METHOD_SHORT_LABELS[s.key] ?? s.label)}
                </label>
                <input
                  type="color"
                  className="color-pick"
                  value={hexOf(s.color)}
                  aria-label={`Color de ${s.label}`}
                  title={`Color de ${s.label}`}
                  onChange={(event) => setColor(s.key, event.target.value)}
                />
              </span>
            ))}
          </div>
        </fieldset>
        <div className="chart-controls__row">
          <fieldset className="chart-controls__group">
            <legend>Tipo</legend>
            <div className="segmented">
              {Object.entries(CHART_TYPES).map(([value, label]) => (
                <label key={value} className={view.type === value ? 'segmented__option segmented__option--on' : 'segmented__option'}>
                  <input type="radio" name={`chart-type-${detail.id ?? 'vivo'}`} value={value} checked={view.type === value} onChange={() => change({ type: value })} />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="inline-field">
            <span>Desde</span>
            <select className="field__control field__control--compact" value={view.from} onChange={(event) => change({ from: event.target.value })}>
              {table.periods.map((period, i) => (
                <option key={period} value={period} disabled={i > end}>
                  {formatPeriod(period, detail.periodicity)}
                </option>
              ))}
            </select>
          </label>
          <label className="inline-field">
            <span>Hasta</span>
            <select className="field__control field__control--compact" value={view.to} onChange={(event) => change({ to: event.target.value })}>
              {table.periods.map((period, i) => (
                <option key={period} value={period} disabled={i < start}>
                  {formatPeriod(period, detail.periodicity)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="chart-controls__row">
          <label className="check">
            <input type="checkbox" checked={view.showValues} onChange={(event) => change({ showValues: event.target.checked })} />
            Mostrar valores
          </label>
          <label className="check" title={fixedZero ? 'Las columnas siempre arrancan en 0.' : undefined}>
            <input
              type="checkbox"
              checked={fixedZero || view.zeroBased}
              disabled={fixedZero}
              onChange={(event) => change({ zeroBased: event.target.checked })}
            />
            Eje Y desde 0{fixedZero && ' (fijo con columnas)'}
          </label>
          <button type="button" className="btn btn--small btn--ghost" onClick={reset} disabled={isInitial}>
            Restablecer vista
          </button>
          {canExport && (
            <span className="chart-controls__downloads">
              <button
                type="button"
                className="btn btn--small btn--ghost"
                onClick={() => onExport('png', async () => download(await svgToPng(image()), `${name}-grafico.png`))}
              >
                Descargar PNG
              </button>
              <button
                type="button"
                className="btn btn--small btn--ghost"
                onClick={() => onExport('svg', async () => download(new Blob([image().svg], { type: 'image/svg+xml' }), `${name}-grafico.svg`))}
              >
                Descargar SVG
              </button>
            </span>
          )}
        </div>
      </div>
      {series.length === 0 ? (
        <p className="chart__empty">Elija al menos una serie para ver el gráfico.</p>
      ) : (
        <LineChart
          ref={chartRef}
          title={`${measure}${detail.periodicity === TEST_PERIODICITY ? ' por periodo' : ' mensual'} (${detail.unit})`}
          periodicity={detail.periodicity}
          periods={periods}
          series={series}
          type={view.type}
          columnKeys={['real']}
          showValues={view.showValues}
          zeroBased={view.zeroBased}
        />
      )}
    </>
  );
}

