import { useState } from 'react';
import { changeUserRole, changeUserStatus } from '../../api/admin';
import ConfirmDialog from '../../components/ConfirmDialog';
import { formatDateTime } from './labels';

/**
 * Lista de cuentas con cambio de rol y activación/desactivación, ambos con confirmación.
 * La fila del propio usuario no permite esas acciones; el backend aplica la regla de todos modos.
 */
export default function UsersTable({ users, roles, currentUserId, onUpdated, onProblem }) {
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);
  const roleName = (code) => roles.find((role) => role.code === code)?.name ?? code;

  const confirm = async () => {
    setBusy(true);
    try {
      const updated =
        pending.type === 'role'
          ? await changeUserRole(pending.user.id, pending.role)
          : await changeUserStatus(pending.user.id, pending.active);
      onUpdated(updated, pending);
    } catch (error) {
      onProblem(error);
    } finally {
      setBusy(false);
      setPending(null);
    }
  };

  return (
    <>
      <div className="table-wrap">
        <table className="table">
          <caption className="visually-hidden">Usuarios del sistema</caption>
          <thead>
            <tr>
              <th scope="col">Usuario</th>
              <th scope="col">Rol</th>
              <th scope="col">Estado</th>
              <th scope="col">Creado</th>
              <th scope="col">
                <span className="visually-hidden">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const isSelf = user.id === currentUserId;
              return (
                <tr key={user.id}>
                  <th scope="row" className="table__strong">
                    {user.username}
                    {isSelf && <span className="tag">usted</span>}
                  </th>
                  <td>
                    <select
                      className="field__control field__control--compact"
                      aria-label={`Rol de ${user.username}`}
                      value={user.role}
                      disabled={isSelf}
                      title={isSelf ? 'No puede cambiar su propio rol.' : undefined}
                      onChange={(event) => setPending({ type: 'role', user, role: event.target.value })}
                    >
                      {roles.map((role) => (
                        <option key={role.code} value={role.code}>
                          {role.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <span className={user.active ? 'badge badge--ok' : 'badge badge--off'}>
                      {user.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="table__muted">{formatDateTime(user.createdAt)}</td>
                  <td className="table__actions">
                    <button
                      type="button"
                      className={user.active ? 'btn btn--small btn--danger-ghost' : 'btn btn--small btn--ghost'}
                      disabled={isSelf}
                      title={isSelf ? 'No puede desactivar su propia cuenta.' : undefined}
                      onClick={() => setPending({ type: 'status', user, active: !user.active })}
                    >
                      {user.active ? 'Desactivar' : 'Activar'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={pending !== null}
        busy={busy}
        danger={pending?.type === 'status' && !pending.active}
        title={dialogTitle(pending)}
        confirmLabel={dialogConfirmLabel(pending)}
        onConfirm={confirm}
        onCancel={() => setPending(null)}
      >
        {pending?.type === 'role' && (
          <p>
            ¿Cambiar el rol de <strong>{pending.user.username}</strong> de {roleName(pending.user.role)} a{' '}
            <strong>{roleName(pending.role)}</strong>? Sus permisos cambian de inmediato.
          </p>
        )}
        {pending?.type === 'status' && pending.active && (
          <p>
            ¿Activar la cuenta de <strong>{pending.user.username}</strong>? Podrá volver a iniciar sesión.
          </p>
        )}
        {pending?.type === 'status' && !pending.active && (
          <p>
            ¿Desactivar la cuenta de <strong>{pending.user.username}</strong>? Su sesión abierta terminará y no
            podrá iniciar sesión.
          </p>
        )}
      </ConfirmDialog>
    </>
  );
}

function dialogTitle(pending) {
  if (!pending) return '';
  if (pending.type === 'role') return 'Cambiar rol';
  return pending.active ? 'Activar usuario' : 'Desactivar usuario';
}

function dialogConfirmLabel(pending) {
  if (!pending) return 'Confirmar';
  if (pending.type === 'role') return 'Cambiar rol';
  return pending.active ? 'Activar' : 'Desactivar';
}
