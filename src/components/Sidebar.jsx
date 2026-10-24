import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { allowedModules } from '../navigation';

export default function Sidebar() {
  const { hasPermission } = useAuth();
  const items = [{ path: '/', label: 'Inicio' }, ...allowedModules(hasPermission)];

  return (
    <nav className="sidebar" aria-label="Menú principal">
      <ul className="sidebar__list">
        {items.map((item) => (
          <li key={item.path}>
            <NavLink
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) => (isActive ? 'sidebar__link sidebar__link--active' : 'sidebar__link')}
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
