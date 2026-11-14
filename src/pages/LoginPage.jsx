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
      <div className="login__hero" aria-hidden="true">
        <img src={logo} alt="" className="login__logo" />
        <p className="login__eyebrow">Sierra Alta S.A.S. BIC</p>
        <p className="login__headline">Plataforma de pronóstico de demanda</p>
        <p className="login__lead">Datos de producción, seis métodos de pronóstico y sus indicadores, recalculados en vivo.</p>
        <svg className="login__spark" viewBox="0 0 320 90">
          <polyline className="login__spark-real" points="0,70 40,52 80,60 120,34 160,46 200,22 240,38 280,14 320,26" />
          <polyline className="login__spark-forecast" points="0,74 40,62 80,58 120,48 160,44 200,34 240,32 280,24 320,20" />
        </svg>
      </div>
      <section className="login__card" aria-labelledby="login-title">
        <h1 className="login__title" id="login-title">
          Iniciar sesión
        </h1>
        <p className="login__subtitle">Sierra Alta · Pronóstico de demanda</p>

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
