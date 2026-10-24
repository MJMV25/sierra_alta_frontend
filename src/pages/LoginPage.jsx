import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import FormField, { fieldErrorsFrom } from '../components/FormField';
import LoadingState from '../components/LoadingState';
import Notice from '../components/Notice';
import ProblemAlert from '../components/ProblemAlert';
import logo from '../assets/eleven-logo.png';

export default function LoginPage() {
  const { status, notice, login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [submitting, setSubmitting] = useState(false);
  const [problem, setProblem] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const sessionMessage = notice;

  if (status === 'loading') return <LoadingState label="Verificando sesión…" fullScreen />;
  if (status === 'authenticated' && !submitting) return <Navigate to="/" replace />;

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
      await login(form.username, form.password);
      navigate(location.state?.from || '/', { replace: true });
    } catch (error) {
      const errors = fieldErrorsFrom(error);
      setFieldErrors(errors);
      // Con errores por campo el detalle general es redundante; los demás errores se muestran tal cual.
      if (Object.keys(errors).length === 0) setProblem(error);
      setSubmitting(false);
    }
  };

  return (
    <div className="login">
      <section className="login__card" aria-labelledby="login-title">
        <div className="login__brand">
          <img src={logo} alt="Eleven Pro" className="login__logo" />
        </div>
        <h1 className="login__title" id="login-title">
          Pronóstico de producción
        </h1>
        <p className="login__subtitle">Sierra Alta S.A.S. BIC</p>

        {sessionMessage && !problem && <Notice tone="warning">{sessionMessage}</Notice>}
        <ProblemAlert problem={problem} />

        <form className="form" onSubmit={handleSubmit} noValidate>
          <FormField
            id="username"
            label="Usuario"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={form.username}
            onChange={handleChange}
            error={fieldErrors.username}
            required
          />
          <FormField
            id="password"
            label="Contraseña"
            type="password"
            autoComplete="current-password"
            value={form.password}
            onChange={handleChange}
            error={fieldErrors.password}
            required
          />
          <button type="submit" className="btn btn--primary btn--block" disabled={submitting}>
            {submitting ? 'Ingresando…' : 'Iniciar sesión'}
          </button>
        </form>
      </section>
    </div>
  );
}
