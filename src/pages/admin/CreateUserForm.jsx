import { useState } from 'react';
import { createUser } from '../../api/admin';
import FormField, { fieldErrorsFrom } from '../../components/FormField';
import ProblemAlert from '../../components/ProblemAlert';

const EMPTY_FORM = { username: '', password: '', role: '' };

export default function CreateUserForm({ roles, onCreated }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [problem, setProblem] = useState(null);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setFieldErrors((current) => ({ ...current, [name]: undefined }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setProblem(null);
    setFieldErrors({});
    try {
      // Un rol vacío se envía como null para que el backend responda con su validación.
      const created = await createUser({ ...form, role: form.role || null });
      setForm(EMPTY_FORM);
      onCreated(created);
    } catch (error) {
      const errors = fieldErrorsFrom(error);
      setFieldErrors(errors);
      setProblem(error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="panel" aria-labelledby="create-user-title">
      <h2 className="panel__title" id="create-user-title">
        Crear usuario
      </h2>
      <ProblemAlert problem={problem} onDismiss={() => setProblem(null)} />
      <form className="form form--grid" onSubmit={handleSubmit} noValidate>
        <FormField
          id="new-username"
          name="username"
          label="Usuario"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          value={form.username}
          onChange={handleChange}
          error={fieldErrors.username}
          hint="De 3 a 50 caracteres: letras, números, punto, guion o guion bajo."
          required
        />
        <FormField
          id="new-password"
          name="password"
          label="Contraseña"
          type="password"
          autoComplete="new-password"
          value={form.password}
          onChange={handleChange}
          error={fieldErrors.password}
          hint="De 10 a 72 caracteres."
          required
        />
        <FormField
          id="new-role"
          name="role"
          label="Rol"
          value={form.role}
          onChange={handleChange}
          error={fieldErrors.role}
          required
        >
          <option value="">Seleccione un rol</option>
          {roles.map((role) => (
            <option key={role.code} value={role.code}>
              {role.name}
            </option>
          ))}
        </FormField>
        <div className="form__actions">
          <button type="submit" className="btn btn--primary" disabled={submitting}>
            {submitting ? 'Creando…' : 'Crear usuario'}
          </button>
        </div>
      </form>
    </section>
  );
}
