import { useCallback, useState } from 'react';
import { getSeriesObservations, listProducts } from '../../api/modules';
import { useAuth } from '../../auth/AuthProvider';
import LineChart from '../../components/LineChart';
import Notice from '../../components/Notice';
import QueryState from '../../components/QueryState';
import { formatNumber, formatPeriod, MEASURE_LABELS } from '../../format';
import { seriesOptions } from '../seriesOptions';
import useModuleQuery from '../useModuleQuery';
import UploadForm from './UploadForm';

export default function HistoryPage() {
  const { hasPermission } = useAuth();
  const products = useModuleQuery(listProducts);
  const [selectedId, setSelectedId] = useState(null);
  const [notice, setNotice] = useState(null);
  const [version, setVersion] = useState(0);

  const handleLoaded = (loaded, option) => {
    const range =
      loaded.firstPeriod === loaded.lastPeriod
        ? formatPeriod(loaded.firstPeriod)
        : `${formatPeriod(loaded.firstPeriod)} a ${formatPeriod(loaded.lastPeriod)}`;
    setNotice(
      `Se cargaron ${loaded.observations} ${loaded.observations === 1 ? 'mes' : 'meses'} de ${option.label} (${range}). ` +
        `Versión de datos: ${loaded.loadId}.`,
    );
    setSelectedId(loaded.seriesId);
    setVersion((n) => n + 1);
    products.reload();
  };

  return (
    <div className="page">
      <header className="page__header">
        <h1 className="page__title">Históricos</h1>
        <p className="page__subtitle">Producción mensual cargada por referencia.</p>
      </header>
      {notice && (
        <Notice tone="success" onDismiss={() => setNotice(null)}>
          {notice}
        </Notice>
      )}
      <QueryState query={products}>
        {(data) => {
          const options = seriesOptions(data);
          return (
            <>
              <section className="panel" aria-labelledby="series-title">
                <h2 className="panel__title" id="series-title">
                  Referencias
                </h2>
                {options.length === 0 ? (
                  <p>No hay referencias activas.</p>
                ) : (
                  <SeriesTable options={options} selectedId={selectedId} onSelect={setSelectedId} />
                )}
              </section>
              {selectedId !== null && (
                <SeriesDetail
                  key={`${selectedId}-${version}`}
                  seriesId={selectedId}
                  onClose={() => setSelectedId(null)}
                />
              )}
              {hasPermission('history:write') && options.length > 0 && (
                <UploadForm options={options} onLoaded={handleLoaded} />
              )}
            </>
          );
        }}
      </QueryState>
    </div>
  );
}

function SeriesTable({ options, selectedId, onSelect }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <caption className="visually-hidden">Referencias con su producción cargada</caption>
        <thead>
          <tr>
            <th scope="col">Referencia</th>
            <th scope="col">Medida</th>
            <th scope="col">Meses cargados</th>
            <th scope="col">Desde</th>
            <th scope="col">Hasta</th>
            <th scope="col">Versión de datos</th>
            <th scope="col">
              <span className="visually-hidden">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {options.map((option) => (
            <tr key={option.seriesId} className={option.seriesId === selectedId ? 'table__row--selected' : undefined}>
              <th scope="row" className="table__strong">
                {option.productName}
                <span className="table__muted table__sub">{option.productCode}</span>
              </th>
              <td>
                {MEASURE_LABELS[option.measure] ?? option.measure} ({option.unit})
              </td>
              <td className="table__number">{option.observations}</td>
              <td>{formatPeriod(option.firstPeriod)}</td>
              <td>{formatPeriod(option.lastPeriod)}</td>
              <td className="table__number">{option.dataVersion ?? '—'}</td>
              <td className="table__actions">
                <button
                  type="button"
                  className="btn btn--small btn--ghost"
                  disabled={option.observations === 0}
                  aria-label={`Ver datos de ${option.label}`}
                  onClick={() => onSelect(option.seriesId)}
                >
                  Ver datos
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SeriesDetail({ seriesId, onClose }) {
  const request = useCallback(() => getSeriesObservations(seriesId), [seriesId]);
  const series = useModuleQuery(request);

  return (
    <section className="panel" aria-labelledby="detail-title">
      <div className="panel__header">
        <h2 className="panel__title" id="detail-title">
          {series.data ? `${series.data.productName}: producción mensual` : 'Producción mensual'}
        </h2>
        <button type="button" className="btn btn--small btn--ghost" onClick={onClose}>
          Cerrar
        </button>
      </div>
      <QueryState query={series}>
        {(data) => {
          const periods = data.observations.map((o) => o.period);
          const measure = MEASURE_LABELS[data.measure] ?? data.measure;
          return (
            <>
              <LineChart
                title={`${measure} mensual (${data.unit})`}
                periods={periods}
                series={[
                  { key: 'real', label: measure, color: 'var(--chart-actual)', values: data.observations.map((o) => Number(o.value)) },
                ]}
              />
              <details className="details">
                <summary>Ver tabla de datos ({data.observations.length} meses)</summary>
                <div className="table-wrap table-wrap--scroll">
                  <table className="table table--compact">
                    <caption className="visually-hidden">Producción por mes</caption>
                    <thead>
                      <tr>
                        <th scope="col">Mes</th>
                        <th scope="col" className="table__number">
                          {measure} ({data.unit})
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.observations.map((o) => (
                        <tr key={o.period}>
                          <th scope="row">{formatPeriod(o.period)}</th>
                          <td className="table__number">{formatNumber(o.value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </>
          );
        }}
      </QueryState>
    </section>
  );
}
