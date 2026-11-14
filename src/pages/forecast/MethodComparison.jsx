import { useState } from 'react';
import Notice from '../../components/Notice';
import ComparisonTable, { SORT_OPTIONS, sortRows } from './ComparisonTable';
import IndicatorBars from './IndicatorBars';

/**
 * Comparación completa de los métodos: tabla ordenable, aviso del estacional y barras de MAD y MAPE. La usan
 * la hoja (recálculo en vivo) y el detalle de un pronóstico guardado.
 */
export default function MethodComparison({ comparison, detail, colors }) {
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
      {detail.methods.length > 1 && detail.methods.some((m) => m.method === 'SEASONAL_MULTIPLICATIVE') && (
        <Notice tone="warning">
          El estacional multiplicativo ajusta cada ciclo con su propio promedio, como el Excel: su MAD y su MAPE no son
          comparables con los de los otros métodos, que pronostican cada periodo solo con datos anteriores. Por eso se
          muestra, pero no compite por el mejor método.
        </Notice>
      )}
      <IndicatorBars rows={sortRows(comparison.methods, sortBy)} colors={colors} unit={detail.unit} />
    </>
  );
}
