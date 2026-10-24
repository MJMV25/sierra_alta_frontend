import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { allowedModules } from '../navigation';

export default function HomePage() {
  const { user, hasPermission } = useAuth();
  const modules = allowedModules(hasPermission);

  return (
    <div className="page">
      <header className="page__header">
        <h1 className="page__title">Bienvenido, {user.username}</h1>
        <p className="page__subtitle">
          Ingresó como <strong>{user.roleName}</strong>. Estos son los módulos disponibles para su rol.
        </p>
      </header>
      {modules.length === 0 ? (
        <p>Su rol no tiene módulos asignados. Consulte con el administrador del sistema.</p>
      ) : (
        <ul className="cards">
          {modules.map((module) => (
            <li key={module.path}>
              <Link to={module.path} className="card">
                <span className="card__title">{module.label}</span>
                <span className="card__text">{module.description}</span>
                <span className="card__cta" aria-hidden="true">
                  Abrir →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
