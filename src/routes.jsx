import { Route, Routes } from 'react-router-dom';
import RequireAuth from './auth/RequireAuth';
import RequirePermission from './auth/RequirePermission';
import Layout from './components/Layout';
import ForbiddenPage from './pages/ForbiddenPage';
import ForecastPage from './pages/ForecastPage';
import HistoryPage from './pages/HistoryPage';
import HomePage from './pages/HomePage';
import IndicatorsPage from './pages/IndicatorsPage';
import LoginPage from './pages/LoginPage';
import NotFoundPage from './pages/NotFoundPage';
import UsersPage from './pages/admin/UsersPage';

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route element={<RequirePermission permission="history:read" />}>
            <Route path="historicos" element={<HistoryPage />} />
          </Route>
          <Route element={<RequirePermission permission="forecast:read" />}>
            <Route path="pronosticos" element={<ForecastPage />} />
          </Route>
          <Route element={<RequirePermission permission="indicators:read" />}>
            <Route path="indicadores" element={<IndicatorsPage />} />
          </Route>
          <Route element={<RequirePermission permission="users:manage" />}>
            <Route path="admin/usuarios" element={<UsersPage />} />
          </Route>
          <Route path="sin-permiso" element={<ForbiddenPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
