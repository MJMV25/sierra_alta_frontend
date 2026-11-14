import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

/** Menú lateral a la izquierda y, a la derecha, el encabezado y el contenido (como el mockup de Industrial). */
export default function Layout() {
  return (
    <div className="layout">
      <a className="skip-link" href="#contenido">
        Saltar al contenido
      </a>
      <Sidebar />
      <div className="layout__body">
        <Topbar />
        <main className="layout__main" id="contenido" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
