import { http } from './http';

export async function listRoles() {
  const { data } = await http.get('/admin/roles');
  return data;
}

export async function listUsers() {
  const { data } = await http.get('/admin/users');
  return data;
}

export async function createUser({ username, password, role }) {
  const { data } = await http.post('/admin/users', { username, password, role });
  return data;
}

export async function changeUserRole(id, role) {
  const { data } = await http.patch(`/admin/users/${id}/role`, { role });
  return data;
}

export async function changeUserStatus(id, active) {
  const { data } = await http.patch(`/admin/users/${id}/status`, { active });
  return data;
}

export async function listSecurityEvents(limit = 100) {
  const { data } = await http.get('/admin/security-events', { params: { limit } });
  return data;
}
