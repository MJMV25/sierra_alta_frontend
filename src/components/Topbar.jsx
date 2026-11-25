import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';

export default function Topbar() {
  const { user, logout } = useAuth();
  const [leaving, setLeaving] = useState(false);

  const handleLogout = async () => {
    setLeaving(true);
    await logout();
  };

  return (
    <header className="topbar">
      <span className="topbar__title">Sierra Alta · Pronóstico de demanda</span>
      <div className="topbar__session">
        <span className="topbar__avatar" aria-hidden="true">
          {(user?.username ?? '?').slice(0, 1).toUpperCase()}
        </span>
        <div className="topbar__user">
          <span className="topbar__username">{user?.username}</span>
          <span className="topbar__role">{user?.roleName}</span>
        </div>
        <button type="button" className="btn btn--small btn--outline-light" onClick={handleLogout} disabled={leaving}>
          {leaving ? 'Cerrando…' : 'Cerrar sesión'}
        </button>
      </div>
    </header>
  );
}
