import { useState } from 'react';
import { listProducts, uploadSeriesObservations } from '../api/modules';
import { useAuth } from '../auth/AuthProvider';
import FormField from '../components/FormField';
import ModuleContent, { ActionResult } from './ModuleContent';
import useModuleQuery from './useModuleQuery';

export default function HistoryPage() {
  const { hasPermission } = useAuth();
  const products = useModuleQuery(listProducts);

  return (
    <div className="page">
      <header className="page__header">
        <h1 className="page__title">Históricos</h1>
        <p className="page__subtitle">Series históricas de producción por producto.</p>
      </header>
      {hasPermission('history:write') && <UploadHistory />}
      <section className="panel" aria-labelledby="products-title">
        <h2 className="panel__title" id="products-title">
          Productos
        </h2>
        <ModuleContent state={products} emptyLabel="No hay productos registrados." />
      </section>
    </div>
  );
}

function UploadHistory() {
  const [seriesId, setSeriesId] = useState('1');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      await uploadSeriesObservations(seriesId);
      setResult({ message: 'Históricos cargados.' });
    } catch (error) {
      setResult({ error });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel" aria-labelledby="upload-title">
      <h2 className="panel__title" id="upload-title">
        Carga de históricos
      </h2>
      <form className="form form--inline" onSubmit={handleSubmit}>
        <FormField
          id="series-id"
          label="Serie"
          type="number"
          min="1"
          value={seriesId}
          onChange={(event) => setSeriesId(event.target.value)}
          required
        />
        <button type="submit" className="btn btn--primary" disabled={busy || !seriesId}>
          {busy ? 'Cargando…' : 'Cargar históricos'}
        </button>
      </form>
      <ActionResult result={result} />
    </section>
  );
}
