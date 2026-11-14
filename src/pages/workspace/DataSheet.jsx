import { useEffect, useRef } from 'react';
import { formatNumber, MONTH_NAMES, periodIndex, TEST_PERIODICITY } from '../../format';
import { nextPeriod } from '../forecast/methodConfig';
import { parseCell, yearBlocks } from './sheetModel';

const SHORT_MONTHS = MONTH_NAMES.map((name) => name.slice(0, 3).toUpperCase());

/**
 * Hoja de datos como la hoja DATOS del Excel: un bloque por año, una fila por referencia, los meses en columnas
 * y el total. Con `editable`, cada celda se escribe como en Excel: flechas o Enter para moverse, y se puede
 * pegar un rango copiado del Excel. Los cambios quedan resaltados hasta guardarlos.
 *
 * `rows`: [{ seriesId, label, stored: Map, values: Map (con el borrador), draft: { periodo: texto } }].
 * `editableUntil`: último mes que se puede escribir (el mes en curso); null, sin límite.
 */
export default function DataSheet({
  rows,
  periods,
  periodicity,
  editable,
  editableUntil = null,
  selectedId,
  onSelect,
  onChange,
  caption,
}) {
  const tableRef = useRef(null);
  const wrapRef = useRef(null);
  const blocks = yearBlocks(periods);

  // Abre mostrando el año más reciente, que es donde se agregan y corrigen meses.
  useEffect(() => {
    if (wrapRef.current) wrapRef.current.scrollTop = wrapRef.current.scrollHeight;
  }, []);
  const isSample = periodicity === TEST_PERIODICITY;
  const canEdit = (period) => editable && period !== null && (editableUntil === null || period <= editableUntil);

  const focusCell = (rowIndex, period) => {
    tableRef.current?.querySelector(`[data-row="${rowIndex}"][data-period="${period}"]`)?.focus();
  };

  const move = (rowIndex, period, key) => {
    if (key === 'ArrowDown' || key === 'Enter') {
      if (rowIndex + 1 < rows.length) focusCell(rowIndex + 1, period);
      else focusCell(0, shiftYear(period, 1));
    } else if (key === 'ArrowUp') {
      if (rowIndex > 0) focusCell(rowIndex - 1, period);
      else focusCell(rows.length - 1, shiftYear(period, -1));
    } else if (key === 'ArrowRight') {
      focusCell(rowIndex, nextPeriod(period));
    } else if (key === 'ArrowLeft') {
      focusCell(rowIndex, previousPeriod(period));
    }
  };

  const handleKeyDown = (event, rowIndex, period) => {
    const input = event.currentTarget;
    const atStart = input.selectionStart === 0 && input.selectionEnd === 0;
    const atEnd = input.selectionStart === input.value.length;
    const horizontal = (event.key === 'ArrowLeft' && atStart) || (event.key === 'ArrowRight' && atEnd);
    if (['ArrowUp', 'ArrowDown', 'Enter'].includes(event.key) || horizontal) {
      event.preventDefault();
      move(rowIndex, period, event.key);
    } else if (event.key === 'Escape') {
      const stored = rows[rowIndex].stored.get(period);
      onChange([{ seriesId: rows[rowIndex].seriesId, period, text: stored === undefined ? '' : String(stored) }]);
    }
  };

  // Un rango copiado del Excel llega como filas separadas por saltos de línea y celdas por tabuladores.
  const handlePaste = (event, rowIndex, period) => {
    const text = event.clipboardData?.getData('text/plain') ?? '';
    if (!/[\t\n]/.test(text.trim())) return;
    event.preventDefault();
    const cells = [];
    text.replace(/\r/g, '').replace(/\n$/, '').split('\n').forEach((line, r) => {
      const row = rows[rowIndex + r];
      if (!row) return;
      let target = period;
      line.split('\t').forEach((value) => {
        if (canEdit(target)) cells.push({ seriesId: row.seriesId, period: target, text: value });
        target = nextPeriod(target);
      });
    });
    onChange(cells);
  };

  return (
    <div className="sheet-wrap" ref={wrapRef}>
      <table className="sheet" ref={tableRef}>
        <caption className="visually-hidden">{caption}</caption>
        {blocks.map((block) => (
          <tbody key={block.year} className="sheet__block">
            <tr className="sheet__head">
              <th scope="col" className="sheet__corner">
                {isSample ? `t = ${periodIndex(block.all[0])} a ${periodIndex(block.all[11])}` : block.year}
              </th>
              {block.all.map((period, i) => (
                <th key={period} scope="col" className="sheet__month">
                  {isSample ? `t = ${periodIndex(period)}` : SHORT_MONTHS[i]}
                </th>
              ))}
              <th scope="col" className="sheet__total-head">
                TOTAL
              </th>
            </tr>
            {rows.map((row, rowIndex) => {
              const yearTotal = block.months.reduce((sum, period) => sum + (period ? (row.values.get(period) ?? 0) : 0), 0);
              const hasData = block.months.some((period) => period && row.values.has(period));
              const selected = row.seriesId === selectedId;
              return (
                <tr key={row.seriesId} className={selected ? 'sheet__row sheet__row--selected' : 'sheet__row'}>
                  <th scope="row" className="sheet__ref">
                    <button
                      type="button"
                      className="sheet__ref-button"
                      aria-pressed={selected}
                      onClick={() => onSelect(row.seriesId)}
                      title="Ver el pronóstico de esta referencia"
                    >
                      {row.label}
                    </button>
                  </th>
                  {block.all.map((period, i) => {
                    const shown = block.months[i] !== null;
                    const label = `${row.label}, ${isSample ? `t = ${periodIndex(period)}` : `${MONTH_NAMES[i]} de ${block.year}`}`;
                    if (!shown && !canEdit(period)) {
                      return <td key={period} className="sheet__cell sheet__cell--off" />;
                    }
                    const draftText = row.draft[period];
                    const stored = row.stored.get(period);
                    if (!canEdit(period)) {
                      return (
                        <td key={period} className="sheet__cell sheet__number">
                          {stored === undefined ? '' : formatNumber(stored)}
                        </td>
                      );
                    }
                    const state = cellState(stored, draftText);
                    return (
                      <td key={period} className={`sheet__cell sheet__cell--${state}`}>
                        <input
                          className="sheet__input"
                          inputMode="numeric"
                          autoComplete="off"
                          aria-label={label}
                          aria-invalid={state === 'invalid' || undefined}
                          title={state === 'invalid' ? parseCell(draftText).error : undefined}
                          data-row={rowIndex}
                          data-period={period}
                          value={draftText ?? (stored === undefined ? '' : String(stored))}
                          onFocus={() => onSelect(row.seriesId)}
                          onChange={(event) => onChange([{ seriesId: row.seriesId, period, text: event.target.value }])}
                          onKeyDown={(event) => handleKeyDown(event, rowIndex, period)}
                          onPaste={(event) => handlePaste(event, rowIndex, period)}
                        />
                      </td>
                    );
                  })}
                  <td className="sheet__cell sheet__number sheet__total">{hasData ? formatNumber(yearTotal) : ''}</td>
                </tr>
              );
            })}
          </tbody>
        ))}
      </table>
    </div>
  );
}

/** 'same' | 'changed' | 'added' | 'removed' | 'invalid', para resaltar la celda. */
function cellState(stored, draftText) {
  if (draftText === undefined) return 'same';
  const parsed = parseCell(draftText);
  if (parsed.error) return 'invalid';
  if (parsed.empty) return stored === undefined ? 'same' : 'removed';
  if (stored === undefined) return 'added';
  return stored === parsed.value ? 'same' : 'changed';
}

function shiftYear(period, years) {
  const [year, month] = period.split('-');
  return `${Number(year) + years}-${month}`;
}

function previousPeriod(period) {
  const [year, month] = period.split('-').map(Number);
  return month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, '0')}`;
}
