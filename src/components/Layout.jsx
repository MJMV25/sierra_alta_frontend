import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function Layout() {
  return (
    <div className="layout">
      <a className="skip-link" href="#contenido">
        Saltar al contenido
      </a>
      <Topbar />
      <div className="layout__body">
        <Sidebar />
        <main className="layout__main" id="contenido" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
