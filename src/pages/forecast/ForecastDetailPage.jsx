import { useCallback, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getExecutionIndicators, getForecast } from '../../api/modules';
import { useAuth } from '../../auth/AuthProvider';
import ProblemAlert from '../../components/ProblemAlert';
import QueryState from '../../components/QueryState';
import { chartToSvg, svgToPng } from '../../export/chartImage';
import { download, fileBaseName, forecastTable, tableCsv } from '../../export/report';
import {
  formatDateTime,
  formatNumber,
  formatPeriod,
  MEASURE_LABELS,
  periodHeader,
  periodWord,
  TEST_PERIODICITY,
  METHOD_LABELS,
  METHOD_SHORT_LABELS,
} from '../../format';
import useModuleQuery from '../useModuleQuery';
import ForecastChart from './ForecastChart';
import MethodComparison from './MethodComparison';
import useSeriesColors from './useSeriesColors';

export default function ForecastDetailPage() {
  const { id } = useParams();
  const request = useCallback(() => getForecast(id), [id]);
  const execution = useModuleQuery(request);

  return (
    <div className="page">
      <p className="page__back no-print">
        <Link to="/pronosticos">← Pronósticos guardados</Link>
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
  // Un color por serie, el mismo en el gráfico, las barras y la tabla.
  const seriesColors = useSeriesColors();
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
            Periodo histórico de {formatPeriod(periodFrom, detail.periodicity)} a {formatPeriod(periodTo, detail.periodicity)} (
            {detail.actuals.length} {periodWord(detail.actuals.length, detail.periodicity)}) ·
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
            {(data) => <MethodComparison comparison={data} detail={detail} colors={seriesColors.colors} />}
          </QueryState>
        ) : (
          <p>Su rol no consulta indicadores.</p>
        )}
      </section>

      <section className="panel" aria-labelledby="chart-title">
        <h2 className="panel__title" id="chart-title">
          {measure} real y pronosticada
        </h2>
        <ForecastChart
          detail={detail}
          measure={measure}
          chartRef={chartRef}
          canExport={canExport}
          onExport={run}
          seriesColors={seriesColors}
        />
        {printImage && <img className="print-only print-chart" src={printImage} alt={`${measure} real y pronosticada`} />}
        <DataTable detail={detail} measure={measure} canExport={canExport} colors={seriesColors.colors} />
      </section>
    </>
  );
}

function DataTable({ detail, measure, canExport, colors }) {
  const table = forecastTable(detail);
  return (
    <details className="details details--print-open" open>
      <summary>
        Ver tabla de datos ({table.periods.length} {periodWord(table.periods.length, detail.periodicity)})
      </summary>
      <div className="table-tools">
        <p className="table-legend">
          <span className="table-legend__item">
            <span className="table-legend__swatch table-legend__swatch--evaluated" aria-hidden="true" />
            {periodHeader(detail.periodicity).replace(' (t)', '')} que entra al MAD y al MAPE
          </span>
          <span className="table-legend__item">
            <span className="table-legend__swatch table-legend__swatch--next" aria-hidden="true" />
            {periodHeader(detail.periodicity).replace(' (t)', '')} pronosticado (sin dato real)
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
          <caption className="visually-hidden">{measure} real y pronóstico de cada método por periodo</caption>
          <thead>
            <tr>
              <th scope="col">{periodHeader(detail.periodicity)}</th>
              <th scope="col" className="table__number">
                Real ({detail.unit})
              </th>
              {table.methods.map((column) => (
                <th key={column.method} scope="col" className="table__number" title={METHOD_LABELS[column.method]}>
                  <span className="table__swatch" style={{ background: colors[column.method] }} aria-hidden="true" />
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
                <th scope="row">{formatPeriod(period, detail.periodicity)}</th>
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
