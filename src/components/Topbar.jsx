import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import logo from '../assets/eleven-logo.png';

export default function Topbar() {
  const { user, logout } = useAuth();
  const [leaving, setLeaving] = useState(false);

  const handleLogout = async () => {
    setLeaving(true);
    await logout();
  };

  return (
    <header className="topbar">
      <div className="topbar__brand">
        <img src={logo} alt="Eleven Pro" className="topbar__logo" />
        <span className="topbar__title">Pronóstico de producción</span>
      </div>
      <div className="topbar__session">
        <div className="topbar__user">
          <span className="topbar__username">{user?.username}</span>
          <span className="topbar__role">{user?.roleName}</span>
        </div>
        <button type="button" className="btn btn--outline-light" onClick={handleLogout} disabled={leaving}>
          {leaving ? 'Cerrando…' : 'Cerrar sesión'}
        </button>
      </div>
    </header>
  );
}
