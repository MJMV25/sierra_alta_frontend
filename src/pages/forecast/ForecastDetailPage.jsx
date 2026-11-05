import { useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getExecutionIndicators, getForecast } from '../../api/modules';
import { useAuth } from '../../auth/AuthProvider';
import LineChart from '../../components/LineChart';
import QueryState from '../../components/QueryState';
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
import ComparisonTable from './ComparisonTable';

/** Color fijo por método (no por posición en la ejecución): el mismo método siempre se ve igual. */
const METHOD_COLORS = Object.fromEntries(METHOD_ORDER.map((method, i) => [method, `var(--chart-${i + 1})`]));

export default function ForecastDetailPage() {
  const { id } = useParams();
  const request = useCallback(() => getForecast(id), [id]);
  const execution = useModuleQuery(request);

  return (
    <div className="page">
      <p className="page__back">
        <Link to="/pronosticos">← Pronósticos</Link>
      </p>
      <QueryState query={execution}>{(detail) => <Detail detail={detail} />}</QueryState>
    </div>
  );
}

function Detail({ detail }) {
  const { hasPermission } = useAuth();
  const measure = MEASURE_LABELS[detail.measure] ?? detail.measure ?? 'Producción';
  return (
    <>
      <header className="page__header">
        <h1 className="page__title">
          Pronóstico n.º {detail.id}: {detail.productName}
        </h1>
        <p className="page__subtitle">
          Ejecutado el {formatDateTime(detail.executedAt)} · versión de datos {detail.dataVersion} · versión de cálculo{' '}
          {detail.calculationVersion} · {detail.actuals.length} meses, de {formatPeriod(detail.actuals[0]?.period)} a{' '}
          {formatPeriod(detail.actuals[detail.actuals.length - 1]?.period)}
        </p>
      </header>

      <section className="panel" aria-labelledby="comparison-title">
        <h2 className="panel__title" id="comparison-title">
          Comparación de métodos
        </h2>
        {hasPermission('indicators:read') ? (
          <Comparison detail={detail} unit={detail.unit} />
        ) : (
          <p>Su rol no consulta indicadores.</p>
        )}
      </section>

      <section className="panel" aria-labelledby="chart-title">
        <h2 className="panel__title" id="chart-title">
          {measure} real y pronosticada
        </h2>
        <ForecastChart detail={detail} measure={measure} />
        <DataTable detail={detail} measure={measure} />
      </section>
    </>
  );
}

function Comparison({ detail, unit }) {
  const request = useCallback(() => getExecutionIndicators(detail.id), [detail.id]);
  const comparison = useModuleQuery(request);
  return (
    <QueryState query={comparison}>
      {(data) => <ComparisonTable comparison={data} detail={detail} unit={unit} />}
    </QueryState>
  );
}

/** Meses con real más el mes pronosticado; cada método trae null donde no tiene pronóstico. */
function chartData(detail) {
  const next = detail.methods[0]?.nextForecast?.period;
  const periods = [...detail.actuals.map((a) => a.period), ...(next ? [next] : [])];
  const forecastsOf = (method) => {
    const byPeriod = new Map([...method.forecasts, method.nextForecast].filter(Boolean).map((p) => [p.period, Number(p.forecast)]));
    return periods.map((period) => byPeriod.get(period) ?? null);
  };
  return { periods, forecastsOf };
}

function ForecastChart({ detail, measure }) {
  const { periods, forecastsOf } = chartData(detail);
  const series = [
    {
      key: 'real',
      label: `${measure} real`,
      color: 'var(--chart-actual)',
      values: periods.map((period) => {
        const actual = detail.actuals.find((a) => a.period === period);
        return actual ? Number(actual.value) : null;
      }),
    },
    ...detail.methods.map((method) => ({
      key: method.method,
      label: METHOD_LABELS[method.method] ?? method.method,
      color: METHOD_COLORS[method.method],
      dashed: true,
      values: forecastsOf(method),
    })),
  ];
  return <LineChart title={`${measure} mensual (${detail.unit})`} periods={periods} series={series} />;
}

function DataTable({ detail, measure }) {
  const { periods, forecastsOf } = chartData(detail);
  const columns = detail.methods.map((method) => ({ method: method.method, values: forecastsOf(method) }));
  const actualOf = new Map(detail.actuals.map((a) => [a.period, a.value]));
  const evaluated = (period) => detail.evaluationStart && period >= detail.evaluationStart && actualOf.has(period);

  return (
    <details className="details" open>
      <summary>Ver tabla de datos ({periods.length} meses)</summary>
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
      <div className="table-wrap table-wrap--scroll">
        <table className="table table--compact table--sticky">
          <caption className="visually-hidden">{measure} real y pronóstico de cada método por mes</caption>
          <thead>
            <tr>
              <th scope="col">Mes</th>
              <th scope="col" className="table__number">
                Real ({detail.unit})
              </th>
              {columns.map((column) => (
                <th key={column.method} scope="col" className="table__number" title={METHOD_LABELS[column.method]}>
                  <span className="table__swatch" style={{ background: METHOD_COLORS[column.method] }} aria-hidden="true" />
                  {METHOD_SHORT_LABELS[column.method] ?? column.method}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {periods.map((period, i) => (
              <tr
                key={period}
                className={
                  !actualOf.has(period) ? 'table__row--next' : evaluated(period) ? 'table__row--evaluated' : undefined
                }
              >
                <th scope="row">{formatPeriod(period)}</th>
                <td className="table__number">{formatNumber(actualOf.get(period))}</td>
                {columns.map((column) => (
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
