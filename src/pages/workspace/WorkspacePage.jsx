import { useCallback, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { executeForecast, getSeriesObservations, listProducts, saveSheet } from '../../api/modules';
import { useAuth } from '../../auth/AuthProvider';
import ConfirmDialog from '../../components/ConfirmDialog';
import Notice from '../../components/Notice';
import ProblemAlert from '../../components/ProblemAlert';
import QueryState from '../../components/QueryState';
import { download } from '../../export/report';
import { formatPeriod, MEASURE_LABELS, TEST_PERIODICITY } from '../../format';
import ForecastChart from '../forecast/ForecastChart';
import MethodComparison from '../forecast/MethodComparison';
import { enabledMethods, initialConfigFor, toRequest } from '../forecast/methodConfig';
import useSeriesColors from '../forecast/useSeriesColors';
import { seriesOptions } from '../seriesOptions';
import useModuleQuery from '../useModuleQuery';
import ChangeHistory from './ChangeHistory';
import DataSheet from './DataSheet';
import KpiCards from './KpiCards';
import ParameterBar from './ParameterBar';
import ResultsTable from './ResultsTable';
import { actualsOf, changesFor, currentMonth, effectiveValues, parseCell, storedValues, summarize, visiblePeriods } from './sheetModel';
import useLivePreview from './useLivePreview';

const TABS = { company: 'Datos de Sierra Alta', samples: 'Datos de ejemplo' };

/**
 * Pantalla de inicio (pedido de Industrial, ADR 13 del backend): la hoja de datos de la empresa como en el
 * Excel y, debajo, el pronóstico de la referencia elegida, que se recalcula en vivo al cambiar un dato o un
 * parámetro, sin cambiar de pantalla.
 */
export default function WorkspacePage() {
  const products = useModuleQuery(listProducts);
  const [tab, setTab] = useState('company');

  return (
    <div className="page">
      <header className="page__header">
        <h1 className="page__title">Hoja de datos y pronóstico</h1>
        <p className="page__subtitle">
          Corrija o agregue meses y cambie los parámetros: el pronóstico, los indicadores y el gráfico se recalculan al
          instante.
        </p>
      </header>
      <div className="tabs" role="tablist" aria-label="Datos">
        {Object.entries(TABS).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            id={`tab-${value}`}
            aria-selected={tab === value}
            aria-controls={`panel-${value}`}
            className={tab === value ? 'tabs__tab tabs__tab--active' : 'tabs__tab'}
            onClick={() => setTab(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        <QueryState query={products}>
          {(data) => (
            <Workspace
              key={tab}
              sample={tab === 'samples'}
              options={seriesOptions(data.filter((product) => Boolean(product.sample) === (tab === 'samples')))}
              onSaved={products.reload}
            />
          )}
        </QueryState>
      </div>
    </div>
  );
}

function Workspace({ sample, options, onSaved }) {
  const ids = options.map((option) => option.seriesId).join(',');
  const [version, setVersion] = useState(0);
  const request = useCallback(
    () => Promise.all(ids.split(',').filter(Boolean).map((id) => getSeriesObservations(Number(id)))),
    [ids, version], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const observations = useModuleQuery(request);

  if (options.length === 0) {
    return <p className="panel__text">No hay referencias {sample ? 'de ejemplo' : 'de la empresa'} en el catálogo.</p>;
  }
  return (
    <QueryState query={observations}>
      {(data) => (
        <SheetAndForecast
          sample={sample}
          options={options}
          observations={data}
          version={version}
          onSaved={() => {
            setVersion((n) => n + 1);
            onSaved();
          }}
        />
      )}
    </QueryState>
  );
}

function SheetAndForecast({ sample, options, observations, version, onSaved }) {
  const { hasPermission } = useAuth();
  const canEditSheet = sample || hasPermission('history:write');
  const canSaveForecast = hasPermission('forecast:execute');
  const periodicity = sample ? TEST_PERIODICITY : 'MENSUAL';
  const today = currentMonth();
  const editableUntil = sample ? null : today;

  const [drafts, setDrafts] = useState({});
  const [selectedId, setSelectedId] = useState(options[0].seriesId);
  const [configs, setConfigs] = useState({});
  const [ranges, setRanges] = useState({});
  const [notice, setNotice] = useState(null);
  const [problem, setProblem] = useState(null);
  const [busy, setBusy] = useState(null);
  const [confirmRemoval, setConfirmRemoval] = useState(false);
  const fileRef = useRef(null);
  const seriesColors = useSeriesColors();

  const rows = useMemo(
    () =>
      options.map((option, i) => {
        const stored = storedValues(observations[i].observations);
        const draft = drafts[option.seriesId] ?? {};
        return {
          ...option,
          dataVersion: observations[i].dataVersion,
          unit: observations[i].unit,
          stored,
          draft,
          values: effectiveValues(stored, draft),
        };
      }),
    [options, observations, drafts],
  );
  const summary = summarize(rows, drafts);
  const pending = summary.added + summary.corrected + summary.removed;
  let periods = visiblePeriods(rows, drafts, 0, today);
  if (canEditSheet && editableUntil && (periods.length === 0 || periods[periods.length - 1] < editableUntil)) {
    periods = [...periods, editableUntil];
  }

  const selected = rows.find((row) => row.seriesId === selectedId) ?? rows[0];
  const selectedPeriods = [...selected.values.keys()].sort();
  const selectedDirty = changesFor(selected.stored, selected.draft).changes.length > 0;
  const config = configs[selected.seriesId] ?? initialConfigFor(selected.productCode);
  const range = rangeOf(ranges[selected.seriesId], selectedPeriods);
  const preview = useLivePreview({
    seriesId: selectedPeriods.length > 0 ? selected.seriesId : null,
    config,
    from: range.from === selectedPeriods[0] ? undefined : range.from,
    to: range.to === selectedPeriods[selectedPeriods.length - 1] ? undefined : range.to,
    actuals: selectedDirty ? actualsOf(selected.values) : null,
  });

  const changeCells = (cells) => {
    setNotice(null);
    setDrafts((current) => {
      const next = { ...current };
      cells.forEach(({ seriesId, period, text }) => {
        const row = rows.find((r) => r.seriesId === seriesId);
        const stored = row?.stored.get(period);
        const series = { ...(next[seriesId] ?? {}) };
        const parsed = parseCell(text);
        // Volver al valor guardado quita la celda del borrador.
        if ((parsed.empty && stored === undefined) || (!parsed.error && !parsed.empty && parsed.value === stored)) {
          delete series[period];
        } else {
          series[period] = text;
        }
        next[seriesId] = series;
      });
      return next;
    });
  };

  const save = async () => {
    setConfirmRemoval(false);
    setProblem(null);
    setBusy('sheet');
    try {
      await saveSheet(summary.series);
      setNotice(`Se guardaron ${describeSummary(summary)}. Los pronósticos guardados antes no cambian.`);
      setDrafts({});
      onSaved();
    } catch (error) {
      setProblem(error);
    } finally {
      setBusy(null);
    }
  };

  const saveForecast = async () => {
    setProblem(null);
    setBusy('forecast');
    try {
      const chosen = enabledMethods(config);
      const created = await executeForecast(
        {
          seriesId: selected.seriesId,
          from: range.from === selectedPeriods[0] ? undefined : range.from,
          to: range.to === selectedPeriods[selectedPeriods.length - 1] ? undefined : range.to,
          methods: chosen.map((method) => toRequest(method, config[method])),
        },
        crypto.randomUUID(),
      );
      setNotice(
        <>
          Pronóstico n.º {created.id} guardado con sus parámetros y datos.{' '}
          <Link to={`/pronosticos/${created.id}`}>Ver el pronóstico guardado</Link>
        </>,
      );
    } catch (error) {
      setProblem(error);
    } finally {
      setBusy(null);
    }
  };

  const exportExcel = async () => {
    setProblem(null);
    setBusy('export');
    try {
      const { buildSheetWorkbook, workbookBlob } = await import('../../export/sheetExcel');
      const workbook = await buildSheetWorkbook(rows.map((row) => ({ label: row.productName, stored: row.stored })));
      download(await workbookBlob(workbook), `datos-produccion-sierra-alta-${today}.xlsx`);
    } catch (error) {
      setProblem({ detail: `No se pudo exportar: ${error.message}` });
    } finally {
      setBusy(null);
    }
  };

  const importExcel = async (file) => {
    if (!file) return;
    setProblem(null);
    setNotice(null);
    setBusy('import');
    try {
      const { readSheetWorkbook } = await import('../../export/sheetExcel');
      const result = await readSheetWorkbook(
        await file.arrayBuffer(),
        rows.map((row) => ({ seriesId: row.seriesId, name: row.productName, code: row.productCode })),
      );
      const cells = result.values
        .filter(({ seriesId, period, value }) => rows.find((r) => r.seriesId === seriesId)?.values.get(period) !== value)
        .map(({ seriesId, period, value }) => ({ seriesId, period, text: String(value) }));
      changeCells(cells);
      const notes = [
        cells.length === 0
          ? 'El archivo no trae cambios frente a la hoja.'
          : `Se cargaron ${cells.length} ${cells.length === 1 ? 'celda' : 'celdas'} del archivo a la hoja, resaltadas. Revíselas y presione "Guardar cambios".`,
      ];
      if (result.unknown.length > 0) notes.push(`Referencias que no están en el catálogo y se omitieron: ${result.unknown.join(', ')}.`);
      if (result.errors.length > 0) notes.push(`Celdas omitidas: ${result.errors.slice(0, 5).join(' ')}${result.errors.length > 5 ? ` y ${result.errors.length - 5} más.` : ''}`);
      setNotice(notes.join(' '));
    } catch (error) {
      setProblem({ detail: `No se pudo leer el archivo: ${error.message}` });
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const measure = MEASURE_LABELS[selected.measure] ?? 'Producción';
  const forecastBlocked = !preview.data || preview.blocked || preview.loading || selectedDirty || (sample && pending > 0);

  return (
    <>
      <section className="panel" aria-labelledby="sheet-title">
        <div className="panel__header">
          <h2 className="panel__title" id="sheet-title">
            {sample ? 'Spokane y ACME (casos del Excel)' : 'Unidades producidas por referencia'}
          </h2>
          <div className="toolbar" role="group" aria-label="Acciones de la hoja">
            {!sample && (
              <button type="button" className="btn btn--small btn--ghost" onClick={exportExcel} disabled={busy !== null}>
                {busy === 'export' ? 'Generando…' : 'Exportar Excel'}
              </button>
            )}
            {!sample && canEditSheet && (
              <>
                <button type="button" className="btn btn--small btn--ghost" onClick={() => fileRef.current?.click()} disabled={busy !== null}>
                  {busy === 'import' ? 'Leyendo…' : 'Importar Excel'}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="visually-hidden"
                  aria-label="Archivo de Excel a importar"
                  tabIndex={-1}
                  onChange={(event) => importExcel(event.target.files?.[0])}
                />
              </>
            )}
          </div>
        </div>
        <p className="panel__text">
          {sample
            ? 'Datos de ejemplo de la hoja DATOS del Excel, para la presentación. Puede cambiar valores para probar: se recalcula todo, pero nada se guarda.'
            : canEditSheet
              ? 'Escriba como en Excel: flechas o Enter para moverse, y puede pegar un rango copiado del Excel. Elija una referencia para ver su pronóstico.'
              : 'Elija una referencia para ver su pronóstico. Solo el administrador corrige o agrega meses.'}
        </p>
        {periods.length === 0 ? (
          <p className="panel__text">Todavía no hay datos cargados.</p>
        ) : (
          <DataSheet
            rows={rows.map((row) => ({ ...row, label: row.productName }))}
            periods={periods}
            periodicity={periodicity}
            editable={canEditSheet}
            editableUntil={editableUntil}
            selectedId={selected.seriesId}
            onSelect={setSelectedId}
            onChange={changeCells}
            caption={sample ? 'Datos de ejemplo por periodo' : 'Unidades producidas por referencia y mes'}
          />
        )}
        {(pending > 0 || summary.invalid > 0) && (
          <div className="sheet-actions" role="status">
            <p className="sheet-actions__text">
              {pending > 0 ? `${describeSummary(summary)} sin guardar.` : ''}
              {summary.invalid > 0 && ` ${summary.invalid} ${summary.invalid === 1 ? 'celda tiene' : 'celdas tienen'} un valor que no es una cantidad entera.`}
            </p>
            {sample ? (
              <button type="button" className="btn btn--small btn--ghost" onClick={() => setDrafts({})}>
                Volver a los datos del Excel
              </button>
            ) : (
              <>
                <button type="button" className="btn btn--small btn--ghost" onClick={() => setDrafts({})} disabled={busy !== null}>
                  Descartar cambios
                </button>
                <button
                  type="button"
                  className="btn btn--small btn--primary"
                  onClick={() => (summary.removed > 0 ? setConfirmRemoval(true) : save())}
                  disabled={busy !== null || pending === 0 || summary.invalid > 0}
                >
                  {busy === 'sheet' ? 'Guardando…' : 'Guardar cambios'}
                </button>
              </>
            )}
          </div>
        )}
        {notice && <Notice tone="success" onDismiss={() => setNotice(null)}>{notice}</Notice>}
        <ProblemAlert problem={problem} onDismiss={() => setProblem(null)} />
      </section>

      <section className="panel panel--forecast" aria-labelledby="forecast-title">
        <div className="panel__header">
          <h2 className="panel__title" id="forecast-title">
            {selected.productName}
            <span className="panel__title-note">
              {preview.loading ? ' · recalculando…' : selectedDirty ? ' · con datos sin guardar' : ''}
            </span>
          </h2>
          {canSaveForecast && (
            <button
              type="button"
              className="btn btn--small btn--primary"
              onClick={saveForecast}
              disabled={forecastBlocked || busy !== null}
              title={selectedDirty || (sample && pending > 0) ? 'Guarde o descarte los cambios de la hoja antes de guardar el pronóstico.' : undefined}
            >
              {busy === 'forecast' ? 'Guardando…' : 'Guardar pronóstico'}
            </button>
          )}
        </div>
        {selectedPeriods.length === 0 ? (
          <p className="panel__text">Esta referencia no tiene datos: escríbalos en la hoja o importe el Excel.</p>
        ) : (
          <>
            <ParameterBar
              config={config}
              onChange={(next) => setConfigs((current) => ({ ...current, [selected.seriesId]: next }))}
              errors={preview.fieldErrors}
              periods={selectedPeriods}
              range={range}
              onRangeChange={(next) =>
                // Un extremo igual al de la serie se guarda vacío para que siga a la serie cuando se agreguen meses.
                setRanges((current) => ({
                  ...current,
                  [selected.seriesId]: {
                    from: next.from === selectedPeriods[0] ? null : next.from,
                    to: next.to === selectedPeriods[selectedPeriods.length - 1] ? null : next.to,
                  },
                }))
              }
              periodicity={periodicity}
            />
            <ProblemAlert problem={preview.problem} />
            <p className="visually-hidden" aria-live="polite">
              {preview.loading ? 'Recalculando' : preview.data ? 'Resultados actualizados' : ''}
            </p>
            {preview.data && (
              <div className={preview.loading || preview.blocked ? 'live live--stale' : 'live'}>
                <KpiCards preview={preview.data} colors={seriesColors.colors} />
                <h3 className="section-title">
                  {measure} real y pronosticada{' '}
                  <span className="section-title__note">
                    {formatPeriod(preview.data.periodFrom, periodicity)} a {formatPeriod(preview.data.periodTo, periodicity)}
                  </span>
                </h3>
                <ForecastChart
                  detail={{ ...preview.data, id: null }}
                  measure={measure}
                  chartRef={{ current: null }}
                  canExport={false}
                  onExport={() => {}}
                  seriesColors={seriesColors}
                />
                <h3 className="section-title">Comparación de métodos</h3>
                <MethodComparison comparison={preview.data.comparison} detail={preview.data} colors={seriesColors.colors} />
                <h3 className="section-title">Tabla de resultados y trazabilidad</h3>
                <ResultsTable
                  preview={preview.data}
                  defaultMethod={preview.data.comparison.bestByMad[0]}
                  colors={seriesColors.colors}
                />
              </div>
            )}
            {!sample && (
              <details className="details">
                <summary>Historial de cambios de {selected.productName}</summary>
                <ChangeHistory seriesId={selected.seriesId} periodicity={periodicity} version={version} />
              </details>
            )}
          </>
        )}
      </section>

      <ConfirmDialog
        open={confirmRemoval}
        title="¿Borrar meses?"
        confirmLabel="Guardar y borrar"
        danger
        onConfirm={save}
        onCancel={() => setConfirmRemoval(false)}
      >
        Se {summary.removed === 1 ? 'borrará 1 mes' : `borrarán ${summary.removed} meses`} de la hoja. Queda registrado en el
        historial de cambios.
      </ConfirmDialog>
    </>
  );
}

/** Periodo elegido para una referencia; un extremo fuera de los meses disponibles vuelve al de la serie. */
function rangeOf(chosen, periods) {
  const first = periods[0] ?? '';
  const last = periods[periods.length - 1] ?? '';
  const from = chosen?.from && periods.includes(chosen.from) ? chosen.from : first;
  const to = chosen?.to && periods.includes(chosen.to) && chosen.to >= from ? chosen.to : last;
  return { from, to };
}

function describeSummary({ added, corrected, removed }) {
  const parts = [];
  if (added > 0) parts.push(`${added} ${added === 1 ? 'mes nuevo' : 'meses nuevos'}`);
  if (corrected > 0) parts.push(`${corrected} ${corrected === 1 ? 'corrección' : 'correcciones'}`);
  if (removed > 0) parts.push(`${removed} ${removed === 1 ? 'mes borrado' : 'meses borrados'}`);
  return parts.join(', ');
}
