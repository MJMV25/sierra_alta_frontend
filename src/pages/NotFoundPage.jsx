import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="page page--center">
      <p className="page__code">404</p>
      <h1 className="page__title">Página no encontrada</h1>
      <p>La dirección que buscó no existe.</p>
      <Link to="/" className="btn btn--primary">
        Volver al inicio
      </Link>
    </div>
  );
}
