import { Link } from 'react-router-dom';

export default function ForbiddenPage() {
  return (
    <div className="page page--center">
      <p className="page__code">403</p>
      <h1 className="page__title">Sin permiso</h1>
      <p>Su rol no tiene acceso a esta sección.</p>
      <Link to="/" className="btn btn--primary">
        Volver al inicio
      </Link>
    </div>
  );
}
