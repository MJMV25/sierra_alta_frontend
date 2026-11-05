import { useCallback, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getExecutionIndicators, getForecast } from '../../api/modules';
import { useAuth } from '../../auth/AuthProvider';
import LineChart from '../../components/LineChart';
import ProblemAlert from '../../components/ProblemAlert';
import QueryState from '../../components/QueryState';
import { chartToSvg, svgToPng } from '../../export/chartImage';
import { download, fileBaseName, forecastTable, tableCsv } from '../../export/report';
import {
  formatDateTime,
  formatNumber,
  formatPeriod,
  MEASURE_LABELS,
  METHOD_LABELS,
  METHOD_ORDER,
  METHOD_SHORT_LABELS,
} from '../../format';
import useModuleQuery from '../useModuleQuery';
import ComparisonTable, { SORT_OPTIONS, sortRows } from './ComparisonTable';
import IndicatorBars from './IndicatorBars';

/** Color fijo por método (no por posición en la ejecución): el mismo método siempre se ve igual. */
const METHOD_COLORS = Object.fromEntries(METHOD_ORDER.map((method, i) => [method, `var(--chart-${i + 1})`]));

const CHART_TYPES = { line: 'Líneas', column: 'Columnas', combo: 'Combinado' };

export default function ForecastDetailPage() {
  const { id } = useParams();
  const request = useCallback(() => getForecast(id), [id]);
  const execution = useModuleQuery(request);

  return (
    <div className="page">
      <p className="page__back no-print">
        <Link to="/pronosticos">← Pronósticos</Link>
      </p>
      <QueryState query={execution}>{(detail) => <Detail detail={detail} />}</QueryState>
    </div>
  );
}

function Detail({ detail }) {
  const { hasPermission } = useAuth();
  const canExport = hasPermission('forecast:export');
  const canReadIndicators = hasPermission('indicators:read');
  const request = useCallback(
    () => (canReadIndicators ? getExecutionIndicators(detail.id) : Promise.resolve(null)),
    [detail.id, canReadIndicators],
  );
  const comparison = useModuleQuery(request);
  const chartRef = useRef(null);
  const [printImage, setPrintImage] = useState(null);
  const [exportProblem, setExportProblem] = useState(null);
  const [exporting, setExporting] = useState(null);
  const measure = MEASURE_LABELS[detail.measure] ?? detail.measure ?? 'Producción';
  const periodFrom = detail.periodFrom ?? detail.actuals[0]?.period;
  const periodTo = detail.periodTo ?? detail.actuals[detail.actuals.length - 1]?.period;

  const run = async (kind, action) => {
    setExportProblem(null);
    setExporting(kind);
    try {
      await action();
    } catch (error) {
      setExportProblem({ detail: `No se pudo exportar: ${error.message}` });
    } finally {
      setExporting(null);
    }
  };

  const chartImage = () => chartToSvg(chartRef.current, { title: `${measure} real y pronosticada · ${detail.productName}` });

  const exportExcel = () =>
    run('excel', async () => {
      const { buildWorkbook } = await import('../../export/excel');
      const image = chartImage();
      const png = { blob: await svgToPng(image), width: image.width, height: image.height };
      download(await buildWorkbook(detail, comparison.data, png), `${fileBaseName(detail)}.xlsx`);
    });

  // PDF: el navegador guarda la página como PDF; el gráfico va completo como imagen, sin desplazamiento.
  const exportPdf = () =>
    run('pdf', async () => {
      const image = chartImage();
      setPrintImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(image.svg)}`);
      await new Promise((resolve) => setTimeout(resolve, 100));
      window.print();
    });

  return (
    <>
      <header className="page__header page__header--row">
        <div>
          <h1 className="page__title">
            Pronóstico n.º {detail.id}: {detail.productName}
          </h1>
          <p className="page__subtitle">
            Periodo histórico de {formatPeriod(periodFrom)} a {formatPeriod(periodTo)} ({detail.actuals.length} meses) ·
            ejecutado el {formatDateTime(detail.executedAt)}
            {detail.executedByUsername && ` por ${detail.executedByUsername}`} · versión de datos {detail.dataVersion} ·
            versión de cálculo {detail.calculationVersion}
          </p>
        </div>
        {canExport && (
          <div className="toolbar no-print" role="group" aria-label="Exportar la ejecución">
            <button type="button" className="btn btn--small btn--ghost" onClick={exportExcel} disabled={exporting !== null}>
              {exporting === 'excel' ? 'Generando…' : 'Exportar a Excel'}
            </button>
            <button type="button" className="btn btn--small btn--ghost" onClick={exportPdf} disabled={exporting !== null}>
              Exportar a PDF
            </button>
          </div>
        )}
      </header>
      <ProblemAlert problem={exportProblem} onDismiss={() => setExportProblem(null)} />

      <section className="panel" aria-labelledby="comparison-title">
        <h2 className="panel__title" id="comparison-title">
          Comparación de métodos
        </h2>
        {canReadIndicators ? (
          <QueryState query={comparison}>
            {(data) => <Comparison comparison={data} detail={detail} />}
          </QueryState>
        ) : (
          <p>Su rol no consulta indicadores.</p>
        )}
      </section>

      <section className="panel" aria-labelledby="chart-title">
        <h2 className="panel__title" id="chart-title">
          {measure} real y pronosticada
        </h2>
        <ForecastChart detail={detail} measure={measure} chartRef={chartRef} canExport={canExport} onExport={run} />
        {printImage && <img className="print-only print-chart" src={printImage} alt={`${measure} real y pronosticada`} />}
        <DataTable detail={detail} measure={measure} canExport={canExport} />
      </section>
    </>
  );
}

function Comparison({ comparison, detail }) {
  const [sortBy, setSortBy] = useState('method');
  return (
    <>
      <div className="panel__controls no-print">
        <label className="inline-field">
          <span>Ordenar</span>
          <select className="field__control field__control--compact" value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
            {Object.entries(SORT_OPTIONS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <ComparisonTable comparison={comparison} detail={detail} unit={detail.unit} sortBy={sortBy} />
      <IndicatorBars
        rows={sortRows(comparison.methods, sortBy)}
        colors={METHOD_COLORS}
        unit={detail.unit}
        threshold={comparison.mapeThresholdPercent}
      />
    </>
  );
}

function initialView(periods) {
  return { hidden: [], type: 'line', showValues: false, zeroBased: true, from: periods[0], to: periods[periods.length - 1] };
}

/** Gráfico con sus opciones de vista: series visibles, tipo, valores, escala y rango de meses. */
function ForecastChart({ detail, measure, chartRef, canExport, onExport }) {
  const table = useMemo(() => forecastTable(detail), [detail]);
  const [view, setView] = useState(() => initialView(table.periods));
  const change = (changes) => setView((current) => ({ ...current, ...changes }));

  const allSeries = [
    { key: 'real', label: `${measure} real`, color: 'var(--chart-actual)', values: table.actuals },
    ...table.methods.map((column) => ({
      key: column.method,
      label: METHOD_LABELS[column.method] ?? column.method,
      color: METHOD_COLORS[column.method],
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
  const isInitial = JSON.stringify(view) === JSON.stringify(initialView(table.periods));
  const name = fileBaseName(detail);
  const image = () => chartToSvg(chartRef.current, { title: `${measure} real y pronosticada · ${detail.productName}` });

  return (
    <>
      <div className="chart-controls no-print">
        <fieldset className="chart-controls__group">
          <legend>Series</legend>
          <div className="chips">
            {allSeries.map((s) => (
              <label key={s.key} className="chip">
                <input type="checkbox" checked={!view.hidden.includes(s.key)} onChange={() => toggle(s.key)} />
                <span className="chip__swatch" style={{ background: s.color }} aria-hidden="true" />
                {s.key === 'real' ? 'Real' : (METHOD_SHORT_LABELS[s.key] ?? s.label)}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="chart-controls__row">
          <fieldset className="chart-controls__group">
            <legend>Tipo</legend>
            <div className="segmented">
              {Object.entries(CHART_TYPES).map(([value, label]) => (
                <label key={value} className={view.type === value ? 'segmented__option segmented__option--on' : 'segmented__option'}>
                  <input type="radio" name={`chart-type-${detail.id}`} value={value} checked={view.type === value} onChange={() => change({ type: value })} />
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
                  {formatPeriod(period)}
                </option>
              ))}
            </select>
          </label>
          <label className="inline-field">
            <span>Hasta</span>
            <select className="field__control field__control--compact" value={view.to} onChange={(event) => change({ to: event.target.value })}>
              {table.periods.map((period, i) => (
                <option key={period} value={period} disabled={i < start}>
                  {formatPeriod(period)}
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
          <button type="button" className="btn btn--small btn--ghost" onClick={() => setView(initialView(table.periods))} disabled={isInitial}>
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
          title={`${measure} mensual (${detail.unit})`}
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

function DataTable({ detail, measure, canExport }) {
  const table = forecastTable(detail);
  return (
    <details className="details details--print-open" open>
      <summary>Ver tabla de datos ({table.periods.length} meses)</summary>
      <div className="table-tools">
        <p className="table-legend">
          <span className="table-legend__item">
            <span className="table-legend__swatch table-legend__swatch--evaluated" aria-hidden="true" />
            Mes que entra al MAD y al MAPE
          </span>
          <span className="table-legend__item">
            <span className="table-legend__swatch table-legend__swatch--next" aria-hidden="true" />
            Mes pronosticado (sin dato real)
          </span>
        </p>
        {canExport && (
          <button
            type="button"
            className="btn btn--small btn--ghost no-print"
            onClick={() => download(new Blob([tableCsv(detail)], { type: 'text/csv;charset=utf-8' }), `${fileBaseName(detail)}-datos.csv`)}
          >
            Descargar tabla (CSV)
          </button>
        )}
      </div>
      <div className="table-wrap table-wrap--scroll">
        <table className="table table--compact table--sticky">
          <caption className="visually-hidden">{measure} real y pronóstico de cada método por mes</caption>
          <thead>
            <tr>
              <th scope="col">Mes</th>
              <th scope="col" className="table__number">
                Real ({detail.unit})
              </th>
              {table.methods.map((column) => (
                <th key={column.method} scope="col" className="table__number" title={METHOD_LABELS[column.method]}>
                  <span className="table__swatch" style={{ background: METHOD_COLORS[column.method] }} aria-hidden="true" />
                  {METHOD_SHORT_LABELS[column.method] ?? column.method}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.periods.map((period, i) => (
              <tr
                key={period}
                className={table.isNext[i] ? 'table__row--next' : table.evaluated[i] ? 'table__row--evaluated' : undefined}
              >
                <th scope="row">{formatPeriod(period)}</th>
                <td className="table__number">{formatNumber(table.actuals[i])}</td>
                {table.methods.map((column) => (
                  <td key={column.method} className="table__number">
                    {formatNumber(column.values[i])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
