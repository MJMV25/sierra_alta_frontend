import { useCallback, useEffect, useState } from 'react';
import { listSecurityEvents } from '../../api/admin';
import LoadingState from '../../components/LoadingState';
import ProblemAlert from '../../components/ProblemAlert';
import { EVENT_RESULT_LABELS, EVENT_TYPE_LABELS, formatDateTime } from './labels';

const RESULT_BADGE = { SUCCESS: 'badge--ok', FAILURE: 'badge--warn', DENIED: 'badge--danger' };

export default function SecurityEventsTable({ users }) {
  const [events, setEvents] = useState(null);
  const [loading, setLoading] = useState(true);
  const [problem, setProblem] = useState(null);
  const usernames = new Map(users.map((user) => [user.id, user.username]));

  const load = useCallback(async () => {
    setLoading(true);
    setProblem(null);
    try {
      setEvents(await listSecurityEvents(100));
    } catch (error) {
      setProblem(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <section className="panel" aria-labelledby="events-title">
      <div className="panel__header">
        <h2 className="panel__title" id="events-title">
          Eventos de seguridad recientes
        </h2>
        <button type="button" className="btn btn--ghost btn--small" onClick={load} disabled={loading}>
          Actualizar
        </button>
      </div>
      <ProblemAlert problem={problem} />
      {loading && !events && <LoadingState />}
      {events && events.length === 0 && <p>No hay eventos registrados.</p>}
      {events && events.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <caption className="visually-hidden">Últimos 100 eventos de seguridad</caption>
            <thead>
              <tr>
                <th scope="col">Fecha</th>
                <th scope="col">Usuario</th>
                <th scope="col">Evento</th>
                <th scope="col">Resultado</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id}>
                  <td className="table__muted">{formatDateTime(event.occurredAt)}</td>
                  <td>{event.userId == null ? '—' : (usernames.get(event.userId) ?? `#${event.userId}`)}</td>
                  <td>{EVENT_TYPE_LABELS[event.type] ?? event.type}</td>
                  <td>
                    <span className={`badge ${RESULT_BADGE[event.result] ?? ''}`}>
                      {EVENT_RESULT_LABELS[event.result] ?? event.result}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
