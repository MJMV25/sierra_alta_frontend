import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import logo from '../assets/eleven-logo.png';
import { allowedModules } from '../navigation';

/** Iconos de línea de 20 px; heredan el color del texto. */
const ICONS = {
  sheet: 'M3 4h14v12H3zM3 8h14M3 12h14M8 4v12',
  forecast: 'M3 16l4-5 3 3 6-8M13 6h3v3',
  indicators: 'M4 16V10M8 16V6M12 16v-4M16 16V4',
  users: 'M7 9a3 3 0 100-6 3 3 0 000 6zM2 17c0-3 2-5 5-5s5 2 5 5M14 9a2.5 2.5 0 100-5M15 12c2 .4 3 2.2 3 5',
};

export default function Sidebar() {
  const { hasPermission } = useAuth();
  const items = allowedModules(hasPermission);

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <img src={logo} alt="" className="sidebar__logo" />
        <div>
          <p className="sidebar__company">Sierra Alta S.A.S. BIC</p>
          <p className="sidebar__product">Plataforma de pronóstico de demanda</p>
        </div>
      </div>
      <nav aria-label="Menú principal">
        <ul className="sidebar__list">
          {items.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) => (isActive ? 'sidebar__link sidebar__link--active' : 'sidebar__link')}
              >
                <svg className="sidebar__icon" viewBox="0 0 20 20" aria-hidden="true">
                  <path d={ICONS[item.icon]} />
                </svg>
                <span className="sidebar__text">
                  <span className="sidebar__label">{item.label}</span>
                  <span className="sidebar__hint">{item.hint}</span>
                </span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
