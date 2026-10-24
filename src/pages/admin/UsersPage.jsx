import { useCallback, useEffect, useState } from 'react';
import { listRoles, listUsers } from '../../api/admin';
import { useAuth } from '../../auth/AuthProvider';
import LoadingState from '../../components/LoadingState';
import Notice from '../../components/Notice';
import ProblemAlert from '../../components/ProblemAlert';
import CreateUserForm from './CreateUserForm';
import SecurityEventsTable from './SecurityEventsTable';
import UsersTable from './UsersTable';

const TABS = [
  { id: 'usuarios', label: 'Usuarios' },
  { id: 'eventos', label: 'Eventos de seguridad' },
];

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [tab, setTab] = useState('usuarios');
  const [users, setUsers] = useState(null);
  const [roles, setRoles] = useState([]);
  const [loadProblem, setLoadProblem] = useState(null);
  const [problem, setProblem] = useState(null);
  const [notice, setNotice] = useState(null);

  const load = useCallback(async () => {
    setLoadProblem(null);
    try {
      const [userList, roleList] = await Promise.all([listUsers(), listRoles()]);
      setUsers(userList);
      setRoles(roleList);
    } catch (error) {
      setLoadProblem(error);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const showNotice = (message) => {
    setProblem(null);
    setNotice(message);
  };

  const handleCreated = (created) => {
    setUsers((current) => [...current, created]);
    showNotice(`Usuario "${created.username}" creado con el rol ${created.roleName}.`);
  };

  const handleUpdated = (updated, action) => {
    setUsers((current) => current.map((user) => (user.id === updated.id ? updated : user)));
    if (action.type === 'role') {
      showNotice(`Rol de "${updated.username}" cambiado a ${updated.roleName}.`);
    } else {
      showNotice(`Cuenta de "${updated.username}" ${updated.active ? 'activada' : 'desactivada'}.`);
    }
  };

  const handleProblem = (error) => {
    setNotice(null);
    setProblem(error);
  };

  return (
    <div className="page">
      <header className="page__header">
        <h1 className="page__title">Administración de usuarios</h1>
        <p className="page__subtitle">Cuentas, roles y eventos de seguridad del sistema.</p>
      </header>

      <div className="tabs" role="tablist" aria-label="Secciones de administración">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`tab-${item.id}`}
            aria-selected={tab === item.id}
            aria-controls={`panel-${item.id}`}
            className={tab === item.id ? 'tabs__tab tabs__tab--active' : 'tabs__tab'}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {loadProblem && (
        <div className="stack">
          <ProblemAlert problem={loadProblem} />
          <button type="button" className="btn btn--ghost" onClick={load}>
            Reintentar
          </button>
        </div>
      )}
      {!loadProblem && users === null && <LoadingState />}

      {users !== null && tab === 'usuarios' && (
        <div role="tabpanel" id="panel-usuarios" aria-labelledby="tab-usuarios" className="stack">
          {notice && (
            <Notice tone="success" onDismiss={() => setNotice(null)}>
              {notice}
            </Notice>
          )}
          <ProblemAlert problem={problem} onDismiss={() => setProblem(null)} />
          <section className="panel" aria-labelledby="users-title">
            <h2 className="panel__title" id="users-title">
              Usuarios ({users.length})
            </h2>
            <UsersTable
              users={users}
              roles={roles}
              currentUserId={currentUser.userId}
              onUpdated={handleUpdated}
              onProblem={handleProblem}
            />
          </section>
          <CreateUserForm roles={roles} onCreated={handleCreated} />
        </div>
      )}

      {users !== null && tab === 'eventos' && (
        <div role="tabpanel" id="panel-eventos" aria-labelledby="tab-eventos">
          <SecurityEventsTable users={users} />
        </div>
      )}
    </div>
  );
}
